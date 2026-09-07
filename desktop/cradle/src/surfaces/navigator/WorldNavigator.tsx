import { useEffect, useRef, useState } from "react";
import { useKernel } from "../../kernel/KernelProvider";
import type { GroundReading, WikiReading, ListedSource } from "../../kernel/types";
import "./navigator.css";

function Wiki({ wiki, label }: { wiki: WikiReading; label: string }) {
  return <details className="world-wiki">
    <summary>{label} <span>{wiki.present ? "bound" : "absent"}</span></summary>
    <p>{wiki.path}</p>
    {wiki.space_ref && <p data-wiki-ref={wiki.space_ref}>{wiki.space_ref}</p>}
    {wiki.revision !== undefined && <p>Revision {wiki.revision}</p>}
    {wiki.error && <p role="status">{wiki.error}</p>}
    {wiki.child_space_refs.length > 0 && <ul aria-label={`${label} children`}>
      {wiki.child_space_refs.map(ref => <li key={ref}>{ref}{wiki.dangling_child_space_refs.includes(ref) ? " — unresolved" : ""}</li>)}
    </ul>}
  </details>;
}

function Ground({ ground }: { ground: GroundReading }) {
  return <dl className="world-ground">
    <dt>Human ground</dt><dd>{ground.user.path} <span>{ground.user.exists ? `${ground.user.sources} sources` : "absent"}</span></dd>
    <dt>Agent governance</dt><dd>{ground.agent_governance.path} <span>{ground.agent_governance.exists ? `${ground.agent_governance.sources} sources` : "absent"}</span></dd>
    <dt>Ground relations</dt><dd data-ground-relations={ground.relations.path}>{ground.relations.path} <span>{ground.relations.present ? `${ground.relations.declared_overrides} declared overrides` : "no declared overrides"}</span></dd>
    {ground.relations.error && <dd role="status">{ground.relations.error}</dd>}
  </dl>;
}

/** Summoned reading over Central's owner operations; selection lives in the
 * kernel. Local state is only filter text and in-flight presentation. */
export function WorldNavigator({ onClose, onOpenSource }: { onClose: () => void; onOpenSource: (source: ListedSource, project: string) => void }) {
  const kernel = useKernel();
  const reading = kernel.snapshot.navigator;
  const [filter, setFilter] = useState("");
  const [pending, setPending] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const entered = useRef(false);
  const root = reading?.root;
  const selected = reading?.project?.project;
  const apply = kernel.apply;
  async function load(project?: string) {
    setPending(true);
    try { await apply(project ? { op: "project_read", project } : { op: "world_read" }); }
    finally { setPending(false); }
  }
  useEffect(() => {
    input.current?.focus();
    if (!entered.current) {
      entered.current = true;
      if (!root) void load();
    }
  }, []);
  const projects = root?.work.projects.filter(p => p.name.toLocaleLowerCase().includes(filter.toLocaleLowerCase())) ?? [];
  return <aside className="world-navigator" aria-label="World navigator" aria-busy={pending}>
    <header><h1>World</h1><button onClick={() => void load()} disabled={pending}>Refresh</button><button onClick={onClose} aria-label="Close World navigator">×</button></header>
    <input ref={input} type="search" aria-label="Filter projects" placeholder="Find a project" value={filter} onChange={e => setFilter(e.target.value)} />
    {pending && <p role="status">Reading Central…</p>}
    {(reading?.error || kernel.opError) && <p role="status">{reading?.error || kernel.opError}</p>}
    {root && <>
      <button className="world-root" aria-current={!selected ? "true" : undefined} onClick={() => void load()}>Central <span>{root.root}</span></button>
      <ul className="world-projects" aria-label="Work projects">
        {projects.map(project => <li key={project.path}>
          <button data-project-path={project.path} aria-current={selected?.path === project.path ? "true" : undefined}
            onClick={() => void load(project.name)}>
            <span>{project.name}</span><small>{project.projectcentral.state === "absent" ? "unbound" : project.projectcentral.state}</small>
          </button>
        </li>)}
      </ul>
      {!projects.length && <p>{root.work.projects.length ? "No matching projects" : "Central disclosed no Work projects"}</p>}
      <section className="world-detail" aria-label={selected ? "Project ground" : "Personal ground"}>
        {selected ? <>
          <h2>{selected.name}</h2><p>{selected.path}</p>
          {reading?.project_ref && <p data-project-ref={reading.project_ref}>{reading.project_ref}</p>}
          {reading?.sources?.world_ref && <p data-world-ref={reading.sources.world_ref}>{reading.sources.world_ref}</p>}
          <p className="world-rooted">Rooted in Central personal ground</p>
          <p>{selected.projectcentral.reason ?? (selected.projectcentral.state === "absent" ? "Ordinary Work project · no ProjectCentral binding" : selected.projectcentral.state)}</p>
          <Ground ground={selected.projectcentral} />
          {reading?.sources && <section aria-label="Project sources">
            <h3>Sources</h3>
            {reading.sources.availability !== "horizon" && <p role="status">{typeof reading.sources.availability === "object" && ("ground_only" in reading.sources.availability ? reading.sources.availability.ground_only.reason : reading.sources.availability.unavailable.reason)}</p>}
            <ul className="world-source-list">
              {reading.sources.sources.map(source => <li key={source.ref}>
                <button data-source-ref={source.ref} onClick={() => onOpenSource(source, selected.name)}>{source.path}</button>
              </li>)}
            </ul>
            {!reading.sources.sources.length && <p>Central disclosed no participating sources</p>}
          </section>}

          <Wiki wiki={selected.projectcentral.agent_wiki.wiki} label="Project wiki" />
          <Wiki wiki={root.control.agent_wiki.wiki} label="Root wiki" />
          {selected.projectcentral.agent_wiki.wiki.space_ref && <p data-federation="true">{root.control.agent_wiki.wiki.child_space_refs.includes(selected.projectcentral.agent_wiki.wiki.space_ref) ? "Project wiki is linked from the root wiki" : "No root wiki link is disclosed for this project"}</p>}
        </> : <><h2>Personal ground</h2><p>{root.ground_state}</p><Ground ground={root.control} /><Wiki wiki={root.control.agent_wiki.wiki} label="Root wiki" /></>}
      </section>
    </>}
  </aside>;
}
