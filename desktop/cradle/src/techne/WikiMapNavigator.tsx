import { useEffect, useState } from "react";
import { useKernel } from "../kernel/KernelProvider";
import { listFiles, readFile } from "../files/client";
import { Glyph } from "../workspace/Glyph";
import "./techne.css";

/**
 * The Technè left body — the wiki map (owner direction 2026-09-18): the
 * whole web as the wikis disclose it, never a file listing. One region per
 * register; a region reads its wiki.json on first open and holds it.
 *
 * Presentation law (owner pass 2026-09-18): the map is a quiet typographic
 * index. State is a right-aligned subtitle on the region head ("reading…",
 * "no wiki", "3 entries"), never a message paragraph. A register whose
 * wiki has one space shows that space's entries directly — no duplicated
 * heading; opening the space in the web is a hover affordance on the head.
 * Entry types are quiet words revealed on hover, not tags on every row.
 */

interface WikiSpace { object: "space"; ref: string; title?: string; node_refs?: string[]; child_space_refs?: string[] }
interface WikiNode { object: "node"; ref: string; title?: string; type?: string }
interface WikiConstellationMember { ref?: string; position?: number; conjugate?: boolean }
interface WikiConstellation { anchor_ref?: string; members?: WikiConstellationMember[] }
interface WikiFrame { object: "frame"; constellations?: WikiConstellation[] }
type WikiObject = WikiSpace | WikiNode | WikiFrame;

type WikiReading =
  | { state: "idle" }
  | { state: "reading" }
  | { state: "ready"; spaces: WikiSpace[]; nodes: WikiNode[]; constellations: WikiConstellation[] }
  | { state: "absent" }
  | { state: "failed"; reason: string };

function parseWiki(content: string): WikiReading {
  const parsed = JSON.parse(content) as { objects?: WikiObject[] };
  const objects = parsed.objects ?? [];
  return {
    state: "ready",
    spaces: objects.filter((entry): entry is WikiSpace => entry.object === "space"),
    nodes: objects.filter((entry): entry is WikiNode => entry.object === "node"),
    constellations: objects.filter((entry): entry is WikiFrame => entry.object === "frame")
      .flatMap(frame => frame.constellations ?? []),
  };
}

function countSubtitle(reading: WikiReading): string {
  switch (reading.state) {
    case "idle": return "";
    case "reading": return "reading…";
    case "absent": return "no wiki";
    case "failed": return "couldn't read";
    case "ready": {
      const entries = reading.nodes.length;
      if (reading.constellations.length > 0) return `${entries} ${entries === 1 ? "entry" : "entries"}, ${reading.constellations.length} ${reading.constellations.length === 1 ? "constellation" : "constellations"}`;
      return entries > 0 ? `${entries} ${entries === 1 ? "entry" : "entries"}` : "no entries yet";
    }
  }
}

export function WikiMapNavigator({ project, onOpenWiki, onMessage }: {
  project?: string;
  onOpenWiki: (ref: string, title: string, project?: string) => void;
  onMessage: (message: string) => void;
}) {
  const kernel = useKernel();
  const projects = kernel.snapshot.navigator?.root?.work.projects ?? [];
  return <div className="wiki-map" aria-label="Wiki map">
    <WikiRegion title="Central" project={undefined} wikiPath="Control/agents/wiki/wiki.json"
      defaultOpen={!project} onOpenWiki={onOpenWiki} onMessage={onMessage}/>
    {projects.map(row => <WikiRegion key={row.path} title={row.name} project={row.name}
      wikiPath={`${row.path}/ProjectCentral/agents/wiki/wiki.json`}
      defaultOpen={row.name === project} onOpenWiki={onOpenWiki} onMessage={onMessage}/>)}
  </div>;
}

/** One register's region: head with a state subtitle, wiki beneath. */
function WikiRegion({ title, project, wikiPath, defaultOpen, onOpenWiki, onMessage }: {
  title: string;
  project: string | undefined;
  wikiPath: string;
  defaultOpen: boolean;
  onOpenWiki: (ref: string, title: string, project?: string) => void;
  onMessage: (message: string) => void;
}) {
  const kernel = useKernel();
  const [reading, setReading] = useState<WikiReading>({ state: "idle" });
  const [opened, setOpened] = useState(defaultOpen);
  const read = () => {
    if (reading.state !== "idle") return;
    setReading({ state: "reading" });
    (async () => {
      const directory = await listFiles(kernel.transport, wikiPath.replace(/\/[^/]+$/, ""));
      const entry = directory.entries.find(candidate => candidate.name === "wiki.json");
      if (!entry) { setReading({ state: "absent" }); return; }
      const file = await readFile(kernel.transport, entry.location);
      setReading(parseWiki(file.content));
    })().catch(reason => {
      const message = String(reason instanceof Error ? reason.message : reason);
      // The owner refuses a listing of a directory that does not exist:
      // this register holds no wiki ground yet.
      if (/No such file or directory/i.test(message)) { setReading({ state: "absent" }); return; }
      setReading({ state: "failed", reason: message });
      onMessage(message);
    });
  };
  useEffect(() => { if (opened) read(); // eslint-disable-line react-hooks/exhaustive-deps
  }, [opened]);
  const open = (ref: string, label: string) => onOpenWiki(ref, label || "Wiki", project);
  const homeSpace = reading.state === "ready"
    ? (reading.spaces.length === 1 ? reading.spaces[0] : reading.spaces.find(space => space.ref.endsWith(":root")))
    : undefined;
  return <details className="wiki-region wiki-region-register" open={opened}
    onToggle={event => { setOpened((event.target as HTMLDetailsElement).open); }}>
    <summary>
      <Glyph name="wiki" size={12}/>
      <span className="wiki-map-name">{title}</span>
      <span className="wiki-map-count">{countSubtitle(reading)}</span>
      {homeSpace && <button className="wiki-open-web" aria-label={`Open the ${title} web`}
        title={`Open the ${title} web`} onClick={event => { event.preventDefault(); open(homeSpace.ref, homeSpace.title ?? "Wiki"); }}>
        <Glyph name="arrow" size={11}/>
      </button>}
    </summary>
    {reading.state === "failed" && <p className="wiki-map-note" role="status">{reading.reason}</p>}
    {reading.state === "ready" && <div className="wiki-region-body">
      {reading.spaces.length > 1 && reading.spaces.map(space => <section key={space.ref} className="wiki-space">
        <header className="wiki-space-head">
          <span className="wiki-space-name">{space.title ?? space.ref}</span>
          <span className="wiki-map-count">{(space.node_refs ?? []).length || ""}</span>
          <button className="wiki-open-web" aria-label={`Open ${space.title ?? "space"} in the web`}
            title={`Open ${space.title ?? "space"} in the web`} onClick={() => open(space.ref, space.title ?? "Wiki")}>
            <Glyph name="arrow" size={10}/>
          </button>
        </header>
        {(space.node_refs ?? []).map(nodeRef => <NodeRow key={nodeRef} node={nodeByRef(reading, nodeRef)} fallbackRef={nodeRef} open={open}/>)}
      </section>)}
      {reading.spaces.length <= 1 && (homeSpace?.node_refs ?? []).map(nodeRef => <NodeRow key={nodeRef} node={nodeByRef(reading, nodeRef)} fallbackRef={nodeRef} open={open}/>)}
      {unplacedNodes(reading).length > 0 && <>
        {reading.spaces.length > 1 && <header className="wiki-space-head"><span className="wiki-space-name">elsewhere</span></header>}
        {unplacedNodes(reading).map(node => <NodeRow key={node.ref} node={node} fallbackRef={node.ref} open={open}/>)}
      </>}
      <Constellations reading={reading} open={open}/>
    </div>}
  </details>;
}

function nodeByRef(reading: Extract<WikiReading, { state: "ready" }>, ref: string): WikiNode | undefined {
  return reading.nodes.find(node => node.ref === ref);
}

function unplacedNodes(reading: Extract<WikiReading, { state: "ready" }>): WikiNode[] {
  const placed = new Set(reading.spaces.flatMap(space => space.node_refs ?? []));
  return reading.nodes.filter(node => !placed.has(node.ref));
}

/** One knowledge entry: title first, its type a quiet word on hover. */
function NodeRow({ node, fallbackRef, open }: {
  node: WikiNode | undefined;
  fallbackRef: string;
  open: (ref: string, title: string) => void;
}) {
  const ref = node?.ref ?? fallbackRef;
  const label = node?.title ?? ref;
  return <button className="wiki-node-row" onClick={() => open(ref, label)} title={node?.type ? `${label} (${node.type})` : label}>
    <span className="wiki-node-title">{label}</span>
    {node?.type && <span className="wiki-node-type">{node.type}</span>}
  </button>;
}

function Constellations({ reading, open }: {
  reading: Extract<WikiReading, { state: "ready" }>;
  open: (ref: string, title: string) => void;
}) {
  if (reading.constellations.length === 0) return null;
  const nodeByRef = new Map(reading.nodes.map(node => [node.ref, node]));
  return <section className="wiki-space">
    <header className="wiki-space-head"><span className="wiki-space-name">constellations</span></header>
    {reading.constellations.map((constellation, index) => <div key={constellation.anchor_ref ?? index} className="wiki-constellation">
      {(constellation.members ?? []).map((member, memberIndex) => {
        const label = nodeByRef.get(member.ref ?? "")?.title ?? member.ref ?? "";
        return <button key={member.ref ?? memberIndex} className="wiki-node-row" disabled={!member.ref}
          onClick={() => member.ref && open(member.ref, label)}
          title={member.position !== undefined ? `${label}, position ${member.position}${member.conjugate ? ", conjugate" : ""}` : label}>
          <span className="wiki-node-title">{label}</span>
          {member.position !== undefined && <span className="wiki-node-type">{`p${member.position}`}</span>}
        </button>;
      })}
    </div>)}
  </section>;
}
