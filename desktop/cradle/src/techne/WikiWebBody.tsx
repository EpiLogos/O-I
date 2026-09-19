/**
 * Instrument 0's body — the wiki web (owner direction 2026-09-19): the
 * arrangement opens directly onto the web as the wikis disclose it, over
 * Central and every disclosed project. No material is required to enter
 * the experience; entries open their knowledge page through the frame's
 * ordinary open path, and bringing material into an instrument remains a
 * deliberate depth on an entry, never the gate.
 */
import {useEffect, useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {listFiles, readFile} from "../files/client";
import {parseWiki, wikiPathForProject, type WikiNode, type WikiReading} from "./wikiReading";
import "./techne.css";

interface Register { title: string; project?: string; path: string }

export function WikiWebBody() {
  const kernel = useKernel();
  const projects = kernel.snapshot.navigator?.root?.work.projects ?? [];
  const registers: Register[] = [
    {title: "Central", path: wikiPathForProject(undefined)},
    ...projects.map(row => ({title: row.name, project: row.name, path: wikiPathForProject(row.path)})),
  ];
  return <div className="wiki-web" aria-label="The wiki web — Instrument 0">
    <header className="wiki-web-head">
      <span className="oi-eyebrow">Instrument 0 · Project / Wiki / Graph</span>
      <h2>The wiki web</h2>
      <p>{registers.length} registers — Central and its projects, as their wikis disclose them.</p>
    </header>
    <div className="wiki-web-registers">
      {registers.map(register => <WikiRegister key={register.path} register={register}/>)}
    </div>
  </div>;
}

function WikiRegister({register}: {register: Register}) {
  const kernel = useKernel();
  const [reading, setReading] = useState<WikiReading>({state: "idle"});
  useEffect(() => {
    let alive = true;
    setReading({state: "reading"});
    void (async () => {
      try {
        const directory = await listFiles(kernel.transport, register.path.replace(/\/[^/]+$/, ""));
        const entry = directory.entries.find(candidate => candidate.name === "wiki.json");
        if (!entry) { if (alive) setReading({state: "absent"}); return; }
        const file = await readFile(kernel.transport, entry.location);
        if (alive) setReading(parseWiki(file.content));
      } catch (reason) {
        if (!alive) return;
        const message = String(reason instanceof Error ? reason.message : reason);
        if (/No such file or directory/i.test(message)) { setReading({state: "absent"}); return; }
        setReading({state: "failed", reason: message});
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [register.path]);

  const open = (ref: string, title: string) =>
    window.dispatchEvent(new CustomEvent("oi:epi-open-knowledge", {detail: {ref, title, project: register.project}}));

  return <section className="wiki-web-register" aria-label={`${register.title} register`}>
    <header className="wiki-web-register-head">
      <h3>{register.title}</h3>
      {reading.state === "ready" && <span className="wiki-web-count">{reading.nodes.length} entries{reading.constellations.length ? ` · ${reading.constellations.length} constellations` : ""}</span>}
      {reading.state === "reading" && <span className="wiki-web-count">reading…</span>}
      {reading.state === "absent" && <span className="wiki-web-count">no wiki</span>}
      {reading.state === "failed" && <span className="wiki-web-count" role="status" title={reading.reason}>couldn't read</span>}
    </header>
    {reading.state === "failed" && <p className="wiki-map-note" role="status">{reading.reason}</p>}
    {reading.state === "ready" && reading.spaces.length + reading.nodes.length === 0 && <p className="wiki-web-note">This register's wiki holds nothing yet.</p>}
    {reading.state === "ready" && reading.spaces.map(space => <div key={space.ref} className="wiki-web-space">
      {reading.spaces.length > 1 && <header className="wiki-web-space-head">{space.title ?? space.ref}</header>}
      <ul>{(space.node_refs ?? []).map(nodeRef => <WikiEntry key={nodeRef} node={reading.nodes.find(node => node.ref === nodeRef)} fallbackRef={nodeRef} open={open}/>)}</ul>
    </div>)}
    {reading.state === "ready" && (() => {
      const placed = new Set(reading.spaces.flatMap(space => space.node_refs ?? []));
      const elsewhere = reading.nodes.filter(node => !placed.has(node.ref));
      return elsewhere.length ? <div className="wiki-web-space">
        <header className="wiki-web-space-head">elsewhere</header>
        <ul>{elsewhere.map(node => <WikiEntry key={node.ref} node={node} fallbackRef={node.ref} open={open}/>)}</ul>
      </div> : null;
    })()}
  </section>;
}

function WikiEntry({node, fallbackRef, open}: {node: WikiNode | undefined; fallbackRef: string; open: (ref: string, title: string) => void}) {
  const ref = node?.ref ?? fallbackRef;
  const label = node?.title ?? ref;
  return <li>
    <button type="button" className="wiki-web-entry" onClick={() => open(ref, label)} title={node?.type ? `${label} (${node.type})` : label}>
      <span className="wiki-web-entry-title">{label}</span>
      {node?.type && <span className="wiki-web-entry-type">{node.type}</span>}
    </button>
  </li>;
}
