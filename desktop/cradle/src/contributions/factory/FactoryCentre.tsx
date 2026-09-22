import {useEffect, useState, type ReactNode} from "react";
import {FactoryDevelopmentSurface} from "./FactoryDevelopmentSurface";
import type {EncounterRow} from "../../encounter/EncounterList";
import {DeskBoard} from "./desk/DeskBoard";
import {DeskRunDetail} from "./desk/DeskRunDetail";
import {FactoryLiveProvider} from "./FactoryLive";
import {
  closeDeskDetail, deskRowForSession, openDeskDetail, peekDeskRow, publishCentreView,
  setLastDeskRun, useCentreView, useDeskDetail, useLastDeskRun,
} from "./desk/deskModel";
import {publishFactorySelection, releaseFactorySelection} from "./sidebar/sidebarModel";
import "./desk/desk.css";

export interface FactoryCentreProps {
  /** The centre Chat: the SAME AgentChat the base-mode panel mounts, bound
   * to the mode's accompanying conversation — never a second chat
   * implementation, never a second composer. */
  chat?:ReactNode;
  /** The Central project the mode is browsing — the Desk's receiving scope
   * and the Run detail's conversation list. */
  project?:string;
  /** The bound conversation, for the Tasks presentation's context and its
   * Run binding. */
  accompanying?:{ref:string;project:string;space:string};
  /** Open a task conversation as the working chat: bind it and move to
   * Tasks — the frame's ordinary start/read pair, never a second one. */
  onOpenTask?:(row:EncounterRow)=>void|Promise<void>;
  onMessage?:(message:string)=>void;
}

/** Factory's centre, in the owner's 2026-09-18 spatial model: Desk is
 * whole-Run-first (the live board, then the full SSSF view of the selected
 * Run); Tasks is chat-first (the full-size working chat over the shared
 * conversation primitives). The left navigator's two entries choose between
 * them; switching changes the working view, never execution. With no
 * conversation bound, Tasks is the genuine new-conversation state — identity,
 * welcome and the full composer, usable by default: first Send provisions a
 * fresh conversation (kernel `encounter_provision`); existing conversations
 * are chosen from the sidebar, the history menu, the Desk or the navigator.
 * The imported development console survives only as a dev-only
 * debugging disclosure, never the normal experience. */
export function FactoryCentre({chat,project,accompanying,onOpenTask,onMessage}:FactoryCentreProps) {
  const view=useCentreView();
  const detail=useDeskDetail();
  const lastRun=useLastDeskRun();
  const [debugOpen,setDebugOpen]=useState(false);

  // The right sidebar's Run subject follows where the person actually is:
  // in Tasks, the task's own bound Run (an exact agent-session match with
  // what the Desk has read) — and a Direct conversation clears the subject
  // instead of inheriting an unrelated Run; back on the Desk, the held Run
  // (the opened detail, else the last Run the desk chose) is re-established.
  useEffect(()=>{
    if(view==="tasks"){
      const row=accompanying?deskRowForSession(accompanying.ref):undefined;
      if(row?.view)publishFactorySelection({statePath:row.locator.statePath,projectRef:row.locator.projectRef,runRef:row.locator.runRef,view:row.view,observedAtUnixMs:Date.now(),origin:"task"});
      else releaseFactorySelection("any");
      return;
    }
    if(detail)return; // the detail publishes its own selection
    const held=lastRun?peekDeskRow(`${lastRun.statePath}\u0000${lastRun.projectRef}\u0000${lastRun.runRef}`):undefined;
    if(held?.view)publishFactorySelection({statePath:held.locator.statePath,projectRef:held.locator.projectRef,runRef:held.locator.runRef,view:held.view,observedAtUnixMs:Date.now(),origin:"desk"});
    else releaseFactorySelection("any");
  },[view,accompanying?.ref,detail,lastRun]);

  const runLink=view==="tasks"&&accompanying?deskRowForSession(accompanying.ref):undefined;
  const openRunFromTask=()=>{
    if(!runLink)return;
    setLastDeskRun(runLink.locator);
    openDeskDetail(runLink.locator);
    publishCentreView("desk");
  };

  return <main className={"factory-centre"+(view==="tasks"?" factory-tasks":"")} aria-label="Factory" data-centre-view={view}>
    {view==="tasks"
      ? <section className="factory-chat-full" aria-label="Task conversation">
        <header className="factory-chat-context">
          <span className="factory-chat-context-project"><span className="factory-chat-context-mark" aria-hidden="true"/>{accompanying ? accompanying.project || "Central" : project || "Central"}</span>
          {runLink
            ? <button className="oi-action" onClick={openRunFromTask}>Run · {runLink.view?.run.label}</button>
            : <span className="factory-chat-context-direct">{accompanying?"Direct conversation — no Run carries this work":"New conversation"}</span>}
        </header>
        <div className="factory-chat-host">{chat}</div>
      </section>
      : <FactoryLiveProvider>{/* one live observation field per visible Factory centre surface — no poll inside (see FactoryLive.tsx) */}
        {detail
          ? <DeskRunDetail locator={detail} project={project} onBack={closeDeskDetail}
              onOpenTask={row=>void onOpenTask?.(row)}/>
          : <DeskBoard project={project} onMessage={onMessage}/>}
      </FactoryLiveProvider>}
    {import.meta.env.DEV&&view==="desk"&&!detail&&<details className="factory-centre-debug" onToggle={event=>setDebugOpen((event.target as HTMLDetailsElement).open)}>
      <summary>Debug: development console</summary>
      {debugOpen&&<FactoryDevelopmentSurface/>}
    </details>}
  </main>;
}
