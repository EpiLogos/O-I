import {useEffect, useRef, useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {Glyph} from "../workspace/Glyph";
import {scrollWithin} from "../shared/scrollWithin";
import {
  ensureWikiProjection,
  requestWikiSelection,
  setWikiProjectionRegister,
  useWikiProjectionState,
  wikiDocumentOf,
  wikiProjectionOf,
  wikiStandingSubtitle,
  type RegisterStanding,
} from "./wikiProjectionStore";
import type {ExpressionDocument} from "../expression/types";
import type {ProjectedConstellation} from "./wikiExpression";
import "./techne.css";

/**
 * The Technè left body — the wiki map (owner direction 2026-09-18, unified
 * 2026-09-19): the whole web as the ONE Wiki→Expression projection
 * discloses it (`wikiProjectionStore.ts`). This is an APERTURE of that one
 * state, never a second reading of wiki.json and never a parallel
 * navigator law (QL-MEF #213: LIST ↔ TREE ↔ GRAPH over one relation/
 * selection state; O-I #366: the bidirectional law):
 *
 *   LIST   the flat typographic index — every constellation whole and its
 *          members in disclosed order, plus entries the projection does not
 *          place (page-open rows, named "not projected");
 *   TREE   the same objects nested — constellation → members;
 *   GRAPH  the register's current scene drawn from the SAME document —
 *          entities at their own positions, bound typed relations as
 *          lines, no invented edge.
 *
 * A row click asks the ONE state to focus that canonical ref; Instrument
 * 0's centre performs the kernel focus edit, and its selection is this
 * map's selection (the selected row reads as selected here — the same act
 * from either side).
 *
 * Presentation law (owner pass 2026-09-18, kept): the map is a quiet
 * typographic index; state is a right-aligned subtitle on the region head;
 * entry types are quiet words revealed on hover, not tags on every row.
 * The head's hover affordances: project this register in Instrument 0,
 * and open the register's wiki web page.
 */

type Aperture = "list" | "tree" | "graph";
const APERTURE_STORAGE = "oi-cradle.techne.wiki-map-aperture.v1";
const APERTURE_LABEL: Record<Aperture, string> = {list: "List", tree: "Tree", graph: "Graph"};

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
  const store = useWikiProjectionState();
  const [aperture, setAperture] = useState<Aperture>(() => {
    const remembered = typeof window !== "undefined" ? window.localStorage.getItem(APERTURE_STORAGE) as Aperture | null : null;
    return remembered === "list" || remembered === "tree" || remembered === "graph" ? remembered : "tree";
  });
  useEffect(() => { try { window.localStorage.setItem(APERTURE_STORAGE, aperture); } catch { /* per-viewer convenience only */ } }, [aperture]);

  return <div className="wiki-map" aria-label="Wiki map" data-aperture={aperture}>
    <div className="wiki-map-apertures" role="tablist" aria-label="The map's aperture over the one projection">
      {(["list", "tree", "graph"] as const).map(choice => <button key={choice} type="button" role="tab"
        aria-selected={aperture === choice} data-aperture-choice={choice}
        title={choice === "list" ? "Flat index of the whole"
          : choice === "tree" ? "Constellations and their members, nested"
          : "The current scene drawn from the projection itself — same objects, same positions, same relations"}
        onClick={() => setAperture(choice)}>
        {APERTURE_LABEL[choice]}
      </button>)}
    </div>
    {store.registers.map(register => <WikiRegion key={register.key} register={register} aperture={aperture}
      defaultOpen={project ? register.key === project : register.key === "central"}
      activeRegister={store.registerKey === register.key}
      onOpenWiki={onOpenWiki} onMessage={onMessage}/>)}
    {store.registers.length === 0 && <p className="wiki-map-note" role="status">Reading the world's registers…</p>}
  </div>;
}

/** One register's region: head with a state subtitle, the projection's own
 * entries beneath — read once per register through the ONE state. */
function WikiRegion({register, aperture, defaultOpen, activeRegister, onOpenWiki, onMessage}: {
  register: {key: string; title: string; project?: string; projectPath?: string};
  aperture: Aperture;
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

  // Entries the reading holds but the projection does not place: page-open
  // rows, named — never invented projection membership.
  const elsewhere = elsewhereOf(standing);

  // The selected row scrolls quietly into view (the centre's selection may
  // have come from the stage, the transport or another aperture).
  const bodyRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!selectionMatches || aperture === "graph") return;
    const selected = bodyRef.current?.querySelector("[aria-selected='true']");
    if (selected) scrollWithin(selected as HTMLElement);
  }, [selectionMatches, aperture, selection.entityRef, selection.sceneRef]);

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
        title={`Project ${register.title} in Instrument 0`} onClick={event => { event.preventDefault(); setWikiProjectionRegister(register.key); }}>
        <Glyph name="instrument" size={11}/>
      </button>
    </summary>
    {standing.phase === "unavailable" && <p className="wiki-map-note" role="status">{standing.reason}</p>}
    {opened && projection && <div ref={bodyRef} className="wiki-region-body">
      {aperture === "graph"
        ? <RegionGraph standing={standing} rowSelected={rowSelected} onFocus={focusRow}/>
        : (projection.constellations ?? []).map(constellation => aperture === "tree"
          ? <section key={constellation.sceneRef} className="wiki-space">
              <WholeRow constellation={constellation} selected={rowSelected({sceneRef: constellation.sceneRef, entityRef: null})} onFocus={focusRow}/>
              <div className="wiki-constellation">
                {constellation.members.map(member => <MemberRow key={member.entityRef} member={member} sceneRef={constellation.sceneRef}
                  selected={rowSelected({sceneRef: constellation.sceneRef, entityRef: member.entityRef})} onFocus={focusRow}/>)}
                {constellation.members.length === 0 && <p className="wiki-map-note">No members in this scene yet.</p>}
              </div>
            </section>
          : <div key={constellation.sceneRef} className="wiki-space wiki-space-flat">
              <WholeRow constellation={constellation} selected={rowSelected({sceneRef: constellation.sceneRef, entityRef: null})} onFocus={focusRow}/>
              {constellation.members.map(member => <MemberRow key={member.entityRef} member={member} sceneRef={constellation.sceneRef}
                selected={rowSelected({sceneRef: constellation.sceneRef, entityRef: member.entityRef})} onFocus={focusRow}/>)}
            </div>)}
      {aperture !== "graph" && elsewhere.length > 0 && <>
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

/** The GRAPH aperture: the register's current scene drawn from the SAME
 * document the stage presents — entity positions and bound typed relations
 * verbatim, no invented edge, no second layout law. */
function RegionGraph({standing, rowSelected, onFocus}: {
  standing: RegisterStanding;
  rowSelected(row: {sceneRef: string; entityRef: string | null}): boolean;
  onFocus(row: FocusAsk): void;
}) {
  const selection = useWikiProjectionState().selection;
  const document = wikiDocumentOf(standing);
  const sceneRef = selection.sceneRef && document?.scenes.some(scene => scene.scene_ref === selection.sceneRef)
    ? selection.sceneRef
    : document?.scenes[0]?.scene_ref;
  const scene = document?.scenes.find(entry => entry.scene_ref === sceneRef);
  if (!document || !scene) return <p className="wiki-map-note" role="status">The projection's drawing opens with its scene.</p>;
  const placed = scene.entity_refs
    .map((ref): ExpressionDocument["entities"][string] | undefined => document.entities[ref])
    .filter((entity): entity is ExpressionDocument["entities"][string] => !!entity);
  const at = (entity: ExpressionDocument["entities"][string]) => ({
    x: Number(entity.parameters?.x?.value ?? 0),
    y: Number(entity.parameters?.y?.value ?? 0),
  });
  const relations = Object.values(document.relations).filter(relation =>
    scene.entity_refs.includes(relation.from_entity_ref) && scene.entity_refs.includes(relation.to_entity_ref));
  return <figure className="wiki-graph" data-scene-ref={scene.scene_ref}>
    <svg viewBox="-0.62 -0.62 1.24 1.24" role="img" aria-label={`${scene.title} — the projection's own drawing`}>
      {relations.map(relation => {
        const from = at(document.entities[relation.from_entity_ref]), to = at(document.entities[relation.to_entity_ref]);
        return <line key={relation.binding_ref} className="wiki-graph-relation" x1={from.x} y1={from.y} x2={to.x} y2={to.y}/>;
      })}
      {placed.map(entity => {
        const subjectRef = entity.subject?.subject_ref ?? null;
        const position = at(entity);
        const selected = rowSelected({sceneRef: scene.scene_ref, entityRef: entity.entity_ref});
        const ask: FocusAsk = {sceneRef: scene.scene_ref, entityRef: entity.entity_ref, subjectRef, title: entity.title};
        return <g key={entity.entity_ref} className="wiki-graph-node" data-entity-ref={entity.entity_ref}
          data-subject-ref={subjectRef ?? undefined} data-selected={selected || undefined}
          role="button" tabIndex={0} aria-label={`Focus ${entity.title} in Instrument 0`}
          onClick={() => onFocus(ask)}
          onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onFocus(ask); } }}>
          <title>{entity.title}{subjectRef ? ` — ${subjectRef}` : ""}</title>
          <circle cx={position.x} cy={position.y} r={selected ? 0.062 : 0.05}/>
          <text x={position.x} y={position.y + 0.022} textAnchor="middle">{String(entity.parameters?.glyph?.value ?? "·")}</text>
        </g>;
      })}
    </svg>
    <figcaption className="wiki-map-note">
      {scene.title} — the projection's own positions and bound relations
    </figcaption>
  </figure>;
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
