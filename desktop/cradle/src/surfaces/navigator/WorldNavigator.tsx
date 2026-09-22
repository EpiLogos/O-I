import {EncounterList,type EncounterRow} from "../../encounter/EncounterList";
import {RememberedList} from "../../context/RememberedList";
import {ReceivingTray} from "../../receiving/ReceivingTray";
import {UserFlowsList} from "../../flow/UserFlowsList";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useKernel } from "../../kernel/KernelProvider";
import type { CentralLocation } from "../../kernel/types";
import type { ProjectNavigation, ProjectMode } from "../../workspace/store";
import { FileTree } from "../../files/FileTree";
import { ProjectBranch, ProjectModes } from "./ProjectBranch";
import { Glyph } from "../../workspace/Glyph";
import { MODE_CURATION, STRIP_MODES, type WorkspaceMode } from "../../workspace/mode";
import "./navigator.css";

/** Every glyph here comes from the shared `workspace/Glyph` set (icon pass
 * 2026-09-17): each top-level row carries one 13px leading glyph, so the
 * sidebar reads as a single glyph column and a single text column. */
const ROW_GLYPH = 13;

/** Summoned reading over Central's owner operations; selection lives in the
 * kernel. Local state is only filter text and in-flight presentation. */
export function WorldNavigator({ onExplore, mode, onMode, onOpenEncounter, centralFiles, onCentralFilesChange, workspaceSelector, projectNavigation, onNavigationChange, onOpenFile, onProjectChange, onOpenWiki, onOpenToday, activeEncounterRef, onMessage, onOpenFlowInstance, onNewFlow }: { onExplore?:()=>void;mode: WorkspaceMode; onMode: (mode: WorkspaceMode) => void;onOpenEncounter:(row:EncounterRow)=>Promise<void>; centralFiles: boolean; onCentralFilesChange:(files:boolean)=>void; workspaceSelector: ReactNode; searchShortcut?: string; projectNavigation: Record<string, ProjectNavigation>; onNavigationChange: (ref: string, change: Partial<ProjectNavigation>) => void; onSearch?: () => void; onOpenWiki: (ref:string,title:string,project?:string)=>Promise<void>; onOpenFile: (location:CentralLocation)=>Promise<void>; onProjectChange?: (project?: string) => void; onOpenToday?: () => Promise<void>; onAgent?: () => void; activeEncounterRef?: string; onOpenFlowInstance?: (row:import("../../flow/instances").FlowInstanceRow)=>Promise<void>; onNewFlow?: ()=>void; onMessage?: (message: string) => void }) {
  const kernel = useKernel();
  const reading = kernel.snapshot.navigator;
  const [error,setError] = useState<string>();
  const openWiki = (ref:string,title:string,project?:string) => {setError(undefined);void onOpenWiki(ref,title,project).catch(e=>setError(String(e)));};
  const [pending, setPending] = useState(false);
  const [fileRefresh,setFileRefresh] = useState(0);
  const [directoryRefs,setDirectoryRefs] = useState<Record<string,string>>({});
  const entered = useRef(false);
  const root = reading?.root;
  const selected = reading?.project?.project;
  const projectRef = reading?.project_ref;
  // One presentation key per path: the owner ProjectRef when this workspace
  // already holds it, else the entry the workspace persisted (never a second
  // key for the same path), else the ProjectRef, the directory ref, or the
  // path itself — disclosure is local state and never waits on a browse to
  // mint a key. The root path keeps its own ref-minting flow (keyFor("")).
  const keyFor = (path:string) => {
    const persisted = Object.entries(projectNavigation).find(([,value])=>value.locationPath===path)?.[0];
    if (selected?.path === path && projectRef) return projectNavigation[projectRef] ? projectRef : (persisted ?? projectRef);
    return persisted ?? directoryRefs[path] ?? (path || undefined);
  };
  const centralKey = keyFor("");
  const centralMode = projectNavigation[centralKey]?.mode ?? (centralFiles ? "files" : "chats");
  const rootFiles = centralMode === "files";
  const apply = kernel.apply;
  async function load(project?: string, activate = true, fresh = false) {
    setError(undefined);
    setPending(true);
    // The human's row click IS the register choice, so it is recorded before
    // the async browse: a fast "Start writing" after clicking a project names
    // the project just chosen, never the previous register. A failed browse
    // renders its own error and never un-chooses it — writing goes through
    // the owner directly, never through the browse state.
    if (activate) onProjectChange?.(project);
    try { return await apply(fresh ? (project ? { op: "project_browse", project, fresh } : { op: "world_browse", fresh }) : project ? { op: "project_browse", project } : { op: "world_browse" }); }
    finally { setPending(false); }
  }
  useEffect(() => {
    if (!entered.current) {
      entered.current = true;
      if (!root) void load(undefined, false);
    }
  }, []);
  // Owner ruling 2026-09-17: navigator refusals route to the shell's footer
  // status disclosure — no inline message blocks between the sidebar rows.
  const reported = useRef({ local: "", reading: "" });
  useEffect(() => {
    if (error && error !== reported.current.local) { reported.current.local = error; onMessage?.(error); }
  }, [error, onMessage]);
  useEffect(() => {
    const message = reading?.error || kernel.opError;
    if (message && message !== reported.current.reading) { reported.current.reading = message; onMessage?.(message); }
  }, [reading?.error, kernel.opError, onMessage]);
  // Owner ruling 2026-09-18: a project row is a disclosure, not a register
  // choice. Opening and closing are instant local state; the workspace's
  // project context follows the work the reader actually opens (a chat, a
  // file), and Overview names the root register explicitly.
  const changeMode = (path:string, project:string|undefined, mode:ProjectMode) => {
    const key = keyFor(path);
    if (key) onNavigationChange(key,{mode,expanded:true,locationPath:path});
    if (!project) onCentralFilesChange(mode === "files");
  };
  const modes = (path:string,name:string,project?:string) => {
    // Only the row the reader is currently in may show its mode as selected.
    const current = project ? selected?.name===project : !selected;
    return <ProjectModes name={name} mode={projectNavigation[keyFor(path)]?.mode ?? (!project && centralFiles ? "files" : "chats")} current={current} onMode={mode=>changeMode(path,project,mode)}/>;
  };
  const disclose = (path:string, expanded:boolean) => {
    const key = keyFor(path);
    if (key) onNavigationChange(key,{expanded,locationPath:path});
  };
  const projects = root?.work.projects ?? [];
  return <aside className="world-navigator" aria-label="World navigator" aria-busy={pending}>
    <div className="world-scroll">
    {workspaceSelector}
    <section className="central-operating-region" aria-label="Central operating spaces">
    <div className="central-mode-row"><button className="world-root" aria-label="Browse Central root" aria-current={!selected ? "true" : undefined} onClick={() => void load()}><Glyph name="home" size={ROW_GLYPH}/><span>Overview</span></button>{modes("","Central")}</div>
    {onOpenToday&&<div className="central-mode-row"><button className="today-open" aria-label="Open today" onClick={()=>void onOpenToday().catch(reason=>setError(String(reason)))}><Glyph name="today" size={ROW_GLYPH}/><span>Today</span></button></div>}
    {/* SF1: Explore is a whole-world destination at the same altitude as
        Overview and Today — the open/shared field, not a Project mode and
        not System. Opening it leaves the local arrangement untouched. */}
    {onExplore&&<div className="central-mode-row"><button className="explore-open" aria-label="Open Explore" onClick={onExplore}><Glyph name="explore" size={ROW_GLYPH}/><span>Explore</span></button></div>}
      {/* The mode IS Central: its region never collapses to nothing. While
        * the world mapping is absent it says so here, in place — the rows
        * appear the moment the reading lands. */}
      {!root && <p className="project-reading" role="status">{pending ? "Reading Central…" : "Central's world mapping is not read yet — Refresh reads it"}</p>}
      {root && <>
        {/* Owner direction 2026-09-18: the Control tree is ONE space — the
        * user and agent grounds are its regions, reached by expanding. */}
      <RootSpace name="Control" path="Control" refresh={fileRefresh} onOpen={onOpenFile}/>
      {/* The flow carrier's navigator face (restored 2026-09-22: the Control
        * consolidation of 32450cff dropped it as collateral, orphaning the
        * flows list and its New flow entry — flow-canvas has been red since). */}
      <UserFlowsList onOpen={row=>onOpenFlowInstance ? onOpenFlowInstance(row) : Promise.resolve()} onNewFlow={onNewFlow}/>
      </>}
      {root && <>
      {rootFiles && <FileTree path="" onOpen={onOpenFile} refresh={fileRefresh} onRootRef={ref=>setDirectoryRefs(held=>({...held,"":ref}))} expanded={projectNavigation[centralKey]?.directories??[]} onExpansion={directories=>{if(centralKey)onNavigationChange(centralKey,{directories,locationPath:""});}}/>}
      {centralMode === "wiki" && <div className="project-reading"><button className="project-wiki-link" disabled={!root.control.agent_wiki.wiki.space_ref} onClick={()=>openWiki(root.control.agent_wiki.wiki.space_ref!,"Central wiki")}><Glyph name="wiki" size={12}/><span>Central neighbourhood</span></button></div>}
      </>}
    </section>
    <header><h1>Work</h1><button onClick={() => { setFileRefresh(n=>n+1); void load(selected?.name, false, true); }} disabled={pending} aria-label="Refresh Central" title="Refresh Central"><Glyph name="refresh" size={12}/></button></header>
    {root && <>
      {/* Finding 26: this hint used to render as a standalone paragraph
          between the "PROJECTS" label and the list itself, breaking the
          row rhythm — the project list right below it already answers the
          same question by being clickable. Dropped rather than moved: the
          project rows are the affordance. */}
      <>
      <ul className="world-projects" aria-label="Work projects">
        {projects.map(project => {
          const key=keyFor(project.path);
          const navigation=projectNavigation[key] ?? {expanded:selected?.path===project.path,scroll:0,mode:"chats" as const};
          const change=(value:Partial<ProjectNavigation>)=>{if(key)onNavigationChange(key,{...value,locationPath:project.path});};
          const wiki=project.projectcentral.agent_wiki.wiki.space_ref;
          return <ProjectBranch key={project.path} path={project.path} name={project.name} selected={selected?.path===project.path}
            navigation={navigation}
            onDisclosure={expanded=>disclose(project.path,expanded)} onMode={mode=>changeMode(project.path,project.name,mode)} onScroll={scroll=>change({scroll})}>
            {(navigation.mode??"chats") === "files" && <FileTree path={project.path} onOpen={onOpenFile} refresh={fileRefresh}
              onRootRef={ref=>{setDirectoryRefs(held=>({...held,[project.path]:ref}));const ownerKey=key??ref;if(projectNavigation[ownerKey]?.locationPath!==project.path)onNavigationChange(ownerKey,{locationPath:project.path});}}
              expanded={navigation.directories??[`${project.path}/ProjectCentral`,`${project.path}/ProjectCentral/user`]}
              onExpansion={directories=>change({directories})}/>}
            {navigation.mode === "wiki" && <button className="project-wiki-link" disabled={!wiki} onClick={()=>openWiki(wiki!,`${project.name} wiki`,project.name)}><Glyph name="wiki" size={12}/><span>{wiki ? `${project.name} neighbourhood` : "No wiki declared"}</span></button>}
            {(navigation.mode??"chats") === "chats" && <><EncounterList project={project.name} onOpen={onOpenEncounter} activeRef={activeEncounterRef}/><RememberedList path={`Work/${project.name}/ProjectCentral/agents/remembered`} label={project.name}/></>}
            <ReceivingTray project={project.name} refresh={fileRefresh}/>
          </ProjectBranch>;
        })}
      </ul></>
      {!rootFiles&&!projects.length && <p>{root.work.projects.length ? "No matching projects" : "Central disclosed no Work projects"}</p>}

    </>}
    </div>
    {/* Owner pass 2026-09-17: the sidebar's structural bottom row carries the
     * workspace modes consolidated with the System entry — one glyph strip,
     * no words; the old "Factory development"/"System" text rows are gone
     * (Factory development is Factory mode now, reached through the strip). */}
    <div className="world-system">
      <WorldModeStrip mode={mode} onMode={onMode}/>
      <span className="world-mode-separator" aria-hidden="true"/>
      <button type="button" className="world-system-settings" onClick={()=>onMode("settings")} aria-pressed={mode==="settings"} aria-label="Settings" title="Settings"><Glyph name="settings" size={14}/></button>
    </div>
  </aside>;
}

/** The consolidated mode strip: four glyph radios, icon-only; the label and
 * hint live in the tooltip. Arrow keys move and select, as a radiogroup does
 * (roving tabIndex — keyboard parity with the old sidebar-head switch this
 * strip replaces). */
export function WorldModeStrip({mode,onMode}:{mode:WorkspaceMode;onMode:(mode:WorkspaceMode)=>void}) {
  const group=useRef<HTMLDivElement>(null);
  const step=(delta:number)=>{
    const next=STRIP_MODES[(STRIP_MODES.indexOf(mode)+delta+STRIP_MODES.length)%STRIP_MODES.length];
    onMode(next);
    requestAnimationFrame(()=>group.current?.querySelector<HTMLElement>(`[data-mode="${next}"]`)?.focus());
  };
  return <div ref={group} className="world-mode-strip" role="radiogroup" aria-label="Workspace mode"
    onKeyDown={event=>{
      if(event.altKey||event.metaKey||event.ctrlKey)return;
      if(event.key==="ArrowRight"||event.key==="ArrowDown"){event.preventDefault();step(1);}
      else if(event.key==="ArrowLeft"||event.key==="ArrowUp"){event.preventDefault();step(-1);}
    }}>
    {STRIP_MODES.map((id,index)=>{const curation=MODE_CURATION[id];return <button key={id} type="button" role="radio" aria-checked={mode===id} tabIndex={mode===id?0:-1} aria-label={curation.label} data-mode={id} title={`${curation.label} — ${curation.hint} (⌘⌥${index+1})`} onClick={()=>onMode(id)}><Glyph name={curation.glyph} size={14}/></button>;})}
  </div>;
}

/** A root-space affordance reads its real directory through Central on demand. */
function RootSpace({name,path,refresh,onOpen}:{name:string;path:string;refresh:number;onOpen:(location:CentralLocation)=>Promise<void>}) {
  const [open,setOpen]=useState(false);
  const [expanded,setExpanded]=useState<string[]>([]);
  return <div className="central-root-space">
    <button aria-label={`${open ? 'Collapse' : 'Expand'} Central ${name} space`} aria-expanded={open} onClick={()=>setOpen(value=>!value)}><Glyph name="folder" size={ROW_GLYPH}/><span>{name}</span></button>
    {open && <FileTree path={path} refresh={refresh} onOpen={onOpen} expanded={expanded} onExpansion={setExpanded} onRootRef={()=>{}}/>}
  </div>;
}
