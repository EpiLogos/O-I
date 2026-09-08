import {Loading} from "../../shared/Loading";
import {EncounterList,type EncounterRow} from "../../encounter/EncounterList";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useKernel } from "../../kernel/KernelProvider";
import type { CentralLocation } from "../../kernel/types";
import type { ProjectNavigation, ProjectMode } from "../../workspace/store";
import { listFiles } from "../../files/client";
import { FileTree } from "../../files/FileTree";
import { ProjectBranch, ProjectModes } from "./ProjectBranch";
import { Glyph } from "../../workspace/Glyph";
import "./navigator.css";

/** Local line glyphs for controls this surface needs but the shared
 * `workspace/Glyph` set does not yet carry (agent, settings). Kept inline
 * rather than extending that shared component from here. */
function SidebarGlyph({path,size=15}:{path:string;size?:number}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path}/></svg>;
}
const AGENT_GLYPH = "M5 7h14v12H5zM12 3v4M8 12h1m6 0h1M9 16h6";
const SETTINGS_GLYPH = "M4 7h16M4 17h16M8 4v6m8 4v6";

/** Summoned reading over Central's owner operations; selection lives in the
 * kernel. Local state is only filter text and in-flight presentation. */
export function WorldNavigator({ onSystem,onOpenEncounter, centralFiles, onCentralFilesChange, workspaceSelector, searchShortcut, projectNavigation, onNavigationChange, onOpenFile, onProjectChange, onOpenWiki, onSearch, onAgent, activeEncounterRef }: { onSystem:()=>void;onOpenEncounter:(row:EncounterRow)=>Promise<void>; centralFiles: boolean; onCentralFilesChange:(files:boolean)=>void; workspaceSelector: ReactNode; searchShortcut: string; projectNavigation: Record<string, ProjectNavigation>; onNavigationChange: (ref: string, change: Partial<ProjectNavigation>) => void; onSearch: () => void; onOpenWiki: (ref:string,title:string,project?:string)=>Promise<void>; onOpenFile: (location:CentralLocation)=>Promise<void>; onProjectChange?: (project?: string) => void; onAgent?: () => void; activeEncounterRef?: string }) {
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
  // key for the same path), else the ProjectRef or the directory ref.
  const keyFor = (path:string) => {
    const persisted = Object.entries(projectNavigation).find(([,value])=>value.locationPath===path)?.[0];
    if (selected?.path === path && projectRef) return projectNavigation[projectRef] ? projectRef : (persisted ?? projectRef);
    return persisted ?? directoryRefs[path];
  };
  const centralKey = keyFor("");
  const centralMode = projectNavigation[centralKey]?.mode ?? (centralFiles ? "files" : "chats");
  const rootFiles = centralMode === "files";
  const apply = kernel.apply;
  async function load(project?: string, activate = true) {
    setError(undefined);
    setPending(true);
    try { const result = await apply(project ? { op: "project_browse", project } : { op: "world_browse" }); if (activate && result?.result === "world_read" && !result.snapshot.navigator?.error) onProjectChange?.(project); return result; }
    finally { setPending(false); setFileRefresh(n=>n+1); }
  }
  useEffect(() => {
    if (!entered.current) {
      entered.current = true;
      if (!root) void load(undefined, false);
    }
  }, []);
  const changeMode = async (path:string, project:string|undefined, mode:ProjectMode) => {
    const result = await load(project);
    let key = result?.result === "world_read" ? result.snapshot.navigator?.project_ref : undefined;
    if (!key) {
      try { key = (await listFiles(kernel.transport,path)).location.ref; setDirectoryRefs(held=>({...held,[path]:key!})); }
      catch(error) { setError(String(error)); return; }
    }
    onNavigationChange(key,{mode,expanded:true,locationPath:path});
    if (!project) onCentralFilesChange(mode === "files");
  };
  const modes = (path:string,name:string,project?:string) => <ProjectModes name={name} mode={projectNavigation[keyFor(path)]?.mode ?? (!project && centralFiles ? "files" : "chats")} onMode={mode=>void changeMode(path,project,mode)}/>;
  const disclose = async(path:string,project:string,expanded:boolean,browse=false) => {
    let key:string|undefined=keyFor(path);
    if(!key || browse) {
      const result=await load(project);
      key=result?.result === "world_read" ? result.snapshot.navigator?.project_ref ?? undefined : undefined;
      if(!key) {
        try { key=(await listFiles(kernel.transport,path)).location.ref;setDirectoryRefs(held=>({...held,[path]:key!})); }
        catch(error) {setError(String(error));return;}
      }
    }
    onNavigationChange(key,{expanded,locationPath:path});
  };
  const projects = root?.work.projects ?? [];
  return <aside className="world-navigator" aria-label="World navigator" aria-busy={pending}>
    <div className="central-actions">
      <button className="summon-search" onClick={onSearch}>Search <kbd>{searchShortcut}</kbd></button>
      {onAgent && <button className="central-agent-entry" aria-label="Open accompanying agent" title="Open accompanying agent" onClick={onAgent}><SidebarGlyph path={AGENT_GLYPH}/></button>}
      {root?.control.agent_wiki.wiki.space_ref && <button className="central-wiki-entry" aria-label="Central wiki" title="Central wiki" onClick={()=>openWiki(root.control.agent_wiki.wiki.space_ref!,"Central wiki")}><Glyph name="wiki"/></button>}
    </div>
    {workspaceSelector}
    <div className="central-mode-row"><button className="world-root" aria-current={!selected ? "true" : undefined} onClick={() => void load()}>Central</button>{modes("","Central")}</div>
    {error && <p role="alert">{error}</p>}
    <header><h1>Work projects</h1><button onClick={() => void load(selected?.name, false)} disabled={pending} aria-label="Refresh Central">↻</button></header>
    {pending && <Loading label="Reading Central…"/>}
    {(reading?.error || kernel.opError) && <p role="status">{reading?.error || kernel.opError}</p>}
    {root && <>
      {rootFiles && <FileTree path="" onOpen={onOpenFile} refresh={fileRefresh} onRootRef={ref=>setDirectoryRefs(held=>({...held,"":ref}))} expanded={projectNavigation[centralKey]?.directories??[]} onExpansion={directories=>{if(centralKey)onNavigationChange(centralKey,{directories,locationPath:""});}}/>}
      {centralMode === "wiki" && <div className="project-reading"><button disabled={!root.control.agent_wiki.wiki.space_ref} onClick={()=>openWiki(root.control.agent_wiki.wiki.space_ref!,"Central wiki")}>Central neighbourhood</button></div>}
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
            navigation={navigation} onBrowse={()=>void disclose(project.path,project.name,true,true)}
            onDisclosure={expanded=>void disclose(project.path,project.name,expanded)} onMode={mode=>void changeMode(project.path,project.name,mode)} onScroll={scroll=>change({scroll})}>
            {(navigation.mode??"chats") === "files" && <FileTree path={project.path} onOpen={onOpenFile} refresh={fileRefresh}
              onRootRef={ref=>{setDirectoryRefs(held=>({...held,[project.path]:ref}));const ownerKey=key??ref;if(projectNavigation[ownerKey]?.locationPath!==project.path)onNavigationChange(ownerKey,{locationPath:project.path});}}
              expanded={navigation.directories??[`${project.path}/ProjectCentral`,`${project.path}/ProjectCentral/user`]}
              onExpansion={directories=>change({directories})}/>}
            {navigation.mode === "wiki" && <button className="project-wiki-link" disabled={!wiki} onClick={()=>openWiki(wiki!,`${project.name} wiki`,project.name)}>{wiki ? `${project.name} neighbourhood` : "No wiki declared"}</button>}
            {(navigation.mode??"chats") === "chats" && <EncounterList project={project.name} onOpen={onOpenEncounter} activeRef={activeEncounterRef}/>}
          </ProjectBranch>;
        })}
      </ul></>
      {!rootFiles&&!projects.length && <p>{root.work.projects.length ? "No matching projects" : "Central disclosed no Work projects"}</p>}

    </>}
    <div className="world-system"><button onClick={onSystem}><SidebarGlyph path={SETTINGS_GLYPH} size={13}/>System</button></div>
  </aside>;
}
