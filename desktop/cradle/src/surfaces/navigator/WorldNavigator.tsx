import type {EncounterRow} from "../../encounter/EncounterList";
import {CentralGround} from "../../central/CentralGround";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useKernel } from "../../kernel/KernelProvider";
import type { CentralLocation } from "../../kernel/types";
import type { ProjectNavigation, ProjectMode } from "../../workspace/store";
import { FileTree, FileRowDecor } from "../../files/FileTree";
import { ProjectBranch, ProjectModes } from "./ProjectBranch";
import { Glyph } from "../../workspace/Glyph";
import { MODE_CURATION, STRIP_MODES, type WorkspaceMode } from "../../workspace/mode";
import { useEpiLens } from "../../workspace/lens";
import { DestinationRow, OpenWhere, Section, type SectionState } from "../../workspace/left/rows";
import { useLeftHost } from "../../workspace/left/host";
import { ChatRows, useConversations } from "../../workspace/left/ChatRows";
import { FlowRows, RememberedRows } from "../../workspace/left/materialRows";
import { useProjectMarks } from "../../workspace/left/sessionMarks";
import "./navigator.css";

/** The Base body (10-SIDEBARS §3.2): destinations Central · Today · Library
 * · Explore, then CONTROL (the Control file tree), FLOWS and WORK (projects;
 * each expands in place to Chats · Files · Wiki · Remembered). Every row
 * follows the one section/row grammar (§3.4). The head and the foot (scope,
 * search, create · Inbox, modes, Settings) belong to the frame around this
 * body, never to it.
 *
 * The Epi-Logos LENS (D2) re-roots the file trees on the corpus: while it is
 * on, CONTROL and WORK stand aside (kept mounted, so turning the lens off
 * restores them exactly — same rows, same expansion) and the corpus tree
 * takes their place. Nothing opens; the mode and the scope stay put.
 *
 * Selection lives in the kernel; local state is only disclosure and
 * in-flight presentation. */
export function WorldNavigator({ onExplore, onOpenEncounter, centralFiles, onCentralFilesChange, projectNavigation, onNavigationChange, onOpenFile, onOpenWiki, onOpenToday, activeEncounterRef, onMessage, onOpenFlowInstance }: { onExplore?:()=>void;mode?: WorkspaceMode; onMode?: (mode: WorkspaceMode) => void;onOpenEncounter:(row:EncounterRow)=>Promise<void>; centralFiles: boolean; onCentralFilesChange:(files:boolean)=>void; workspaceSelector?: ReactNode; searchShortcut?: string; projectNavigation: Record<string, ProjectNavigation>; onNavigationChange: (ref: string, change: Partial<ProjectNavigation>) => void; onSearch?: () => void; onOpenWiki: (ref:string,title:string,project?:string)=>Promise<void>; onOpenFile: (location:CentralLocation)=>Promise<void>; onProjectChange?: (project?: string) => void; onOpenToday?: () => Promise<void>; onAgent?: () => void; activeEncounterRef?: string; onOpenFlowInstance?: (row:import("../../flow/instances").FlowInstanceRow)=>Promise<void>; onNewFlow?: ()=>void; onMessage?: (message: string) => void }) {
  const kernel = useKernel();
  const host = useLeftHost();
  const lens = useEpiLens();
  const marks = useProjectMarks();
  const reading = kernel.snapshot.navigator;
  const [error,setError] = useState<string>();
  const openWiki = (ref:string,title:string,project?:string) => {setError(undefined);void onOpenWiki(ref,title,project).catch(e=>setError(String(e)));};
  const [pending, setPending] = useState(false);
  const [readFailure, setReadFailure] = useState<string>();
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
  // mint a key.
  const keyFor = (path:string) => {
    const persisted = Object.entries(projectNavigation).find(([,value])=>value.locationPath===path)?.[0];
    if (selected?.path === path && projectRef) return projectNavigation[projectRef] ? projectRef : (persisted ?? projectRef);
    return persisted ?? directoryRefs[path] ?? (path || undefined);
  };
  const centralKey = keyFor("");
  const centralNavigation = projectNavigation[centralKey ?? ""];
  const centralMode: ProjectMode = centralNavigation?.mode ?? (centralFiles ? "files" : "chats");
  const centralOpen = centralNavigation?.expanded === true;
  const apply = kernel.apply;
  // The world reading. Scope is chosen only in the scope menu (§3.6): this
  // body reads Central's root; it never re-scopes on a row click.
  async function load(fresh = false) {
    setError(undefined); setReadFailure(undefined);
    setPending(true);
    try { const outcome = await apply(fresh ? { op: "world_browse", fresh } : { op: "world_browse" }); if (!outcome) setReadFailure("The world mapping didn't answer."); }
    catch (reason) { setReadFailure(String(reason instanceof Error ? reason.message : reason)); }
    finally { setPending(false); }
  }
  useEffect(() => {
    if (!entered.current) {
      entered.current = true;
      if (!root) void load();
    }
  }, []);
  // Owner ruling 2026-09-17: navigator refusals route to the shell's footer
  // status disclosure — no inline message blocks between the sidebar rows.
  const reported = useRef({ local: "", reading: "" });
  useEffect(() => {
    if (error && error !== reported.current.local) { reported.current.local = error; onMessage?.(error); }
  }, [error, onMessage]);
  useEffect(() => {
    const message = reading?.error;
    if (message && message !== reported.current.reading) { reported.current.reading = message; onMessage?.(message); }
  }, [reading?.error, onMessage]);
  const changeMode = (path:string, project:string|undefined, mode:ProjectMode) => {
    const key = keyFor(path);
    if (key) onNavigationChange(key,{mode,expanded:true,locationPath:path});
    if (!project) onCentralFilesChange(mode === "files");
  };
  // The mode shown is written with the disclosure: the store's load path
  // reads an absent mode as "files" while the body shows "chats", so an
  // unwritten mode would reopen a project in a different view after reload.
  const disclose = (path:string, expanded:boolean) => {
    const key = keyFor(path);
    if (key) onNavigationChange(key,{expanded,locationPath:path,mode:projectNavigation[key]?.mode ?? (!path && centralFiles ? "files" : "chats")});
  };
  const projects = root?.work.projects ?? [];
  const focusedRef = kernel.snapshot.focus?.subject?.ref;
  // A6 + §3.4: a file row shows Open beside / Pop out on hover and carries
  // aria-current when it is the file open in the focused pane.
  const decor = {currentRef: focusedRef, trailing: (location: CentralLocation, label: string) => <OpenWhere location={location} label={label}/>};
  // L6/L7: while Central's reading is pending the body's first section says
  // so; a failed read says what failed and offers Retry — the foot still works.
  const worldState: SectionState | undefined = root ? undefined
    : readFailure || reading?.error ? { kind: "error", message: "Couldn't read Central.", detail: "The world mapping didn't answer. Everything already open still works.", onRetry: () => void load(true), reason: readFailure ?? reading?.error ?? undefined }
    : { kind: "loading", what: "Reading Central…" };
  const refresh = () => { setFileRefresh(n=>n+1); void load(true); };
  const centralChats = useConversations(centralOpen && centralMode === "chats" && root ? "" : undefined, fileRefresh);
  return <aside className="world-navigator left-world-body" aria-label="World navigator" aria-busy={pending} data-lens={lens.on || undefined}>
    <div className="world-scroll">
    <FileRowDecor.Provider value={decor}>
    <nav className="left-destinations" aria-label="Destinations">
      <div className="central-mode-row" data-destination="central">
        <DestinationRow glyph="home" label="Central" ariaLabel="Central" selected={centralOpen} onClick={() => disclose("", !centralOpen)}/>
        <ProjectModes name="Central" mode={centralMode} current={centralOpen} onMode={mode => changeMode("", undefined, mode)}/>
      </div>
      {centralOpen && root && <div className="project-reading left-central-root">
        {centralMode === "files" && <FileTree path="" onOpen={onOpenFile} refresh={fileRefresh} onRootRef={ref=>setDirectoryRefs(held=>({...held,"":ref}))} expanded={centralNavigation?.directories??[]} onExpansion={directories=>{if(centralKey)onNavigationChange(centralKey,{directories,locationPath:""});}}/>}
        {centralMode === "wiki" && <button className="project-wiki-link" disabled={!root.control.agent_wiki.wiki.space_ref} onClick={()=>openWiki(root.control.agent_wiki.wiki.space_ref!,"Central wiki")}><Glyph name="wiki" size={12}/><span>Central neighbourhood</span></button>}
        {centralMode === "chats" && <ChatRows project="" label="Central" state={centralChats.state} retry={centralChats.retry} activeRef={activeEncounterRef} onOpen={row => { void Promise.resolve((host.onOpenChat ?? onOpenEncounter)({...row, project: row.project})).catch(reason => setError(String(reason))); }}/>}
      </div>}
      {onOpenToday && <DestinationRow glyph="today" label="Today" ariaLabel="Open today" className="today-open" onClick={() => void onOpenToday().catch(reason => setError(String(reason)))}/>}
      {host.onLibrary && <DestinationRow glyph="wiki" label="Library" ariaLabel="Library" onClick={host.onLibrary}/>}
      {onExplore && <DestinationRow glyph="explore" label="Explore" ariaLabel="Open Explore" className="explore-open" onClick={onExplore}/>}
    </nav>
    {root && <details className="left-central-ground" open>
      <summary>Daily ground</summary>
      <CentralGround project={null} onOpenFile={onOpenFile}/>
    </details>}
    {worldState && <Section id="control" label="Control" state={worldState}/>}
    {root && lens.on && <Section id="epi-corpus" label="Epi-Logos corpus" state={{ kind: "ready", rows: 1 }}>
      <div className="left-corpus" data-corpus-root={`Work/${lens.corpusProject}`}>
        <FileTree path={`Work/${lens.corpusProject}`} onOpen={onOpenFile} refresh={fileRefresh} onRootRef={()=>{}} expanded={projectNavigation[`corpus:${lens.corpusProject}`]?.directories ?? []} onExpansion={directories=>onNavigationChange(`corpus:${lens.corpusProject}`,{directories,locationPath:`lens:Work/${lens.corpusProject}`})}/>
      </div>
    </Section>}
    {/* CONTROL and WORK stay mounted under the lens (hidden), so turning it
      * off restores them exactly — same rows, same expansion. */}
    {root && <div className="left-lens-hold" hidden={lens.on || undefined} data-lens-hold="true">
      <Section id="control" label="Control" state={{ kind: "ready", rows: 1 }}>
        <ControlTree refresh={fileRefresh} onOpen={onOpenFile} expanded={projectNavigation["control:Control"]?.directories ?? []} onExpansion={directories=>onNavigationChange("control:Control",{directories,locationPath:"tree:Control"})}/>
      </Section>
    </div>}
    {root && <FlowRows onOpen={row=>onOpenFlowInstance ? onOpenFlowInstance(row) : Promise.resolve()}/>}
    {root && <div className="left-lens-hold" hidden={lens.on || undefined}>
      <Section id="work" label="Work" count={projects.length} state={{ kind: "ready", rows: projects.length }}
        tools={<button type="button" className="left-icon left-section-tool" onClick={refresh} disabled={pending} aria-label="Refresh Central" title="Refresh Central"><Glyph name="refresh" size={12}/></button>}>
        <ul className="world-projects" aria-label="Work projects">
          {projects.map(project => {
            const key=keyFor(project.path);
            const navigation=projectNavigation[key ?? ""] ?? {expanded:false,scroll:0,mode:"chats" as const};
            const change=(value:Partial<ProjectNavigation>)=>{if(key)onNavigationChange(key,{...value,locationPath:project.path});};
            const wiki=project.projectcentral.agent_wiki.wiki.space_ref;
            const mark=marks[project.name];
            return <ProjectBranch key={project.path} path={project.path} name={project.name} selected={navigation.expanded}
              navigation={navigation} marks={mark}
              onDisclosure={expanded=>disclose(project.path,expanded)} onMode={mode=>changeMode(project.path,project.name,mode)} onScroll={scroll=>change({scroll})}>
              {(navigation.mode??"chats") === "files" && <FileTree path={project.path} onOpen={onOpenFile} refresh={fileRefresh}
                onRootRef={ref=>{setDirectoryRefs(held=>({...held,[project.path]:ref}));const ownerKey=key??ref;if(projectNavigation[ownerKey]?.locationPath!==project.path)onNavigationChange(ownerKey,{locationPath:project.path});}}
                expanded={navigation.directories??[`${project.path}/ProjectCentral`,`${project.path}/ProjectCentral/user`]}
                onExpansion={directories=>change({directories})}/>}
              {navigation.mode === "wiki" && <button className="project-wiki-link" disabled={!wiki} onClick={()=>openWiki(wiki!,`${project.name} wiki`,project.name)}><Glyph name="wiki" size={12}/><span>{wiki ? `${project.name} neighbourhood` : "No wiki declared"}</span></button>}
              {(navigation.mode??"chats") === "chats" && <ProjectChats project={project.name} refresh={fileRefresh} activeRef={activeEncounterRef} onOpen={row => { void Promise.resolve((host.onOpenChat ?? onOpenEncounter)(row)).catch(reason => setError(String(reason))); }}/>}
            </ProjectBranch>;
          })}
        </ul>
      </Section>
    </div>}
    </FileRowDecor.Provider>
    </div>
  </aside>;
}

/** A project's Chats and Remembered, read in place of the branch's rows. */
function ProjectChats({project, refresh, activeRef, onOpen}: {project: string; refresh: number; activeRef?: string; onOpen: (row: EncounterRow) => void}) {
  const {state, retry} = useConversations(project, refresh);
  return <>
    <ChatRows project={project} state={state} retry={retry} activeRef={activeRef} onOpen={onOpen}/>
    <RememberedRows path={`Work/${project}/ProjectCentral/agents/remembered`} label={project}/>
  </>;
}

/** The consolidated mode strip: four glyph radios, icon-only; the label and
 * hint live in the tooltip. Arrow keys move and select, as a radiogroup does
 * (roving tabIndex — keyboard parity with the old sidebar-head switch this
 * strip replaces). It lives in the left frame's foot (10-SIDEBARS §3.1). */
export function WorldModeStrip({mode,onMode}:{mode:WorkspaceMode;onMode:(mode:WorkspaceMode)=>void}) {
  const group=useRef<HTMLDivElement>(null);
  const step=(delta:number)=>{
    const at=Math.max(0,STRIP_MODES.indexOf(mode));
    const next=STRIP_MODES[(at+delta+STRIP_MODES.length)%STRIP_MODES.length];
    onMode(next);
    requestAnimationFrame(()=>group.current?.querySelector<HTMLElement>(`[data-mode="${next}"]`)?.focus());
  };
  const focusable=STRIP_MODES.includes(mode)?mode:STRIP_MODES[0];
  return <div ref={group} className="world-mode-strip" role="radiogroup" aria-label="Workspace mode"
    onKeyDown={event=>{
      if(event.altKey||event.metaKey||event.ctrlKey)return;
      if(event.key==="ArrowRight"||event.key==="ArrowDown"){event.preventDefault();step(1);}
      else if(event.key==="ArrowLeft"||event.key==="ArrowUp"){event.preventDefault();step(-1);}
    }}>
    {STRIP_MODES.map((id,index)=>{const curation=MODE_CURATION[id];const label=id==="base"?"Base":curation.label;return <button key={id} type="button" role="radio" aria-checked={mode===id} tabIndex={focusable===id?0:-1} aria-label={label} data-mode={id} title={`${label} — ${curation.hint} (⌘⌥${index+1})`} onClick={()=>onMode(id)}><Glyph name={curation.glyph} size={14}/></button>;})}
  </div>;
}

/** The Control tree: one space whose regions (user, agents, machines…) are
 * reached by expanding — read through Central on demand. */
function ControlTree({refresh,onOpen,expanded,onExpansion}:{refresh:number;onOpen:(location:CentralLocation)=>Promise<void>;expanded:string[];onExpansion:(directories:string[])=>void}) {
  // The expansion is the workspace's (persisted with the projects'), so a
  // mode switch, a remount or the lens never loses it.
  return <div className="central-root-space left-control-tree">
    <FileTree path="Control" refresh={refresh} onOpen={onOpen} expanded={expanded} onExpansion={onExpansion} onRootRef={()=>{}}/>
  </div>;
}
