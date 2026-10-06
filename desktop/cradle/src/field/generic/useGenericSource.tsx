/**
 * The generic adapter's hook (Epi world OFF): which linked local corpus the field reads. The scope's project (the
 * one scope, `workspace/scope.ts`) is the corpus; with Central scope and no project the field offers the projects
 * the kernel's world reading lists and remembers the person's choice on this device. Nothing is assumed.
 */
import {useEffect, useMemo, useState} from "react";
import {useKernel} from "../../kernel/KernelProvider";
import {useScope, scopeProject} from "../../workspace/scope";
import type {FieldSourceState} from "../useFieldSource";
import {createGenericFieldSource} from "./genericSource";
import {kernelIo} from "./kernelIo";

const KEY = "oi-cradle.field.corpus";
const remembered = () => { try { return window.localStorage.getItem(KEY) ?? undefined; } catch { return undefined; } };

export function useGenericFieldSource(active: boolean): FieldSourceState {
  const kernel = useKernel();
  const scope = useScope();
  const [chosen, setChosen] = useState<string | undefined>(remembered);
  const projects = kernel.snapshot.navigator?.root?.work.projects ?? [];
  const name = scopeProject(scope) ?? chosen;
  const project = projects.find(p => p.name === name);
  // the world is `project:{id}` — the Project's own id, which Central discloses as its wiki space (`central:wiki:project:{id}`);
  // a Project that discloses none is addressed by its directory name, as the ground grammar says
  const idOf = (p: typeof project) => /^central:wiki:project:(.+)$/.exec(p?.projectcentral?.agent_wiki?.wiki?.space_ref ?? "")?.[1] ?? p?.name;
  const transportKey = JSON.stringify(kernel.transport);
  const source = useMemo(() => (active && project ? createGenericFieldSource({
    world: `project:${idOf(project)}`, root: project.path, label: project.name, project: project.name, io: kernelIo(kernel.transport),
  }) : null), [active, project?.name, project?.path, transportKey]);        // eslint-disable-line react-hooks/exhaustive-deps
  const [state, setState] = useState<FieldSourceState>({status: "loading"});
  useEffect(() => {
    if (!active) return;
    if (!source) { setState({status: "unavailable", title: projects.length ? "Choose a corpus" : "No corpus to read yet", reason: projects.length ? "The field reads one linked project at a time. The scope names none; choose one here, or choose a project in the scope menu." : "Central's world reading lists no projects under Work/, so there is nothing to link.", setup: projects.length ? (
      <div className="stubnote">{projects.map(p => <button key={p.name} className="linkbtn" style={{marginRight: 12}} onClick={() => { try { window.localStorage.setItem(KEY, p.name); } catch { /* per-viewer */ } setChosen(p.name); }}>{p.name}</button>)}</div>) : undefined}); return; }
    let live = true;
    setState({status: "loading"});
    source.standing().then(async standing => {
      if (!live) return;
      if (standing.state === "unavailable") { setState({status: "unavailable", title: "This corpus could not be read", reason: standing.reason}); return; }
      const index = await source.load();
      if (!live) return;
      if (!index.nodes.length) { setState({status: "unavailable", title: "No markdown pages here", reason: `${project?.name ?? "This folder"} holds no markdown files the field can read.`}); return; }
      setState({status: "ready", source, index});
    }, e => live && setState({status: "unavailable", title: "This corpus could not be read", reason: e instanceof Error ? e.message : String(e)}));
    return () => { live = false; };
  }, [active, source, projects.length]);                                     // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}
