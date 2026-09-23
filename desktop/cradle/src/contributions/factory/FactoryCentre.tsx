import {useEffect, useState, type ReactNode} from "react";
import {FactoryDevelopmentSurface} from "./FactoryDevelopmentSurface";
import type {EncounterRow} from "../../encounter/EncounterList";
import {Desk} from "./desk/Desk";
import {RunPage, type FactoryObjectRef, type RunPageHost} from "./desk/RunPage";
import {FactoryObjectPage} from "./desk/FactoryObjectPage";
import {publishCentreView, useCentreView} from "./desk/deskModel";
import {closeRunPage, openRunPage, runEntry, runForSession, selectRun, useDeskReading, useOpenRun} from "./desk/deskStore";
import {RUN_STATE_WORD} from "./desk/runModel";
import {clearObjectPages, openObjectPage, closeObjectPage, useObjectPage} from "./desk/objectNav";
import "./desk/desk.css";
import "./desk/fdesk.css";

export interface FactoryCentreProps {
  /** The centre Chat: the SAME AgentChat the base-mode panel mounts, bound
   * to the mode's accompanying conversation — never a second chat
   * implementation, never a second composer. */
  chat?:ReactNode;
  /** The Central project in scope (the one scope). */
  project?:string;
  /** The bound conversation, for the Tasks header's Run join. */
  accompanying?:{ref:string;project:string;space:string};
  /** Open a task conversation as the working chat: bind it and move to
   * Tasks — the frame's ordinary start/read pair, never a second one. */
  onOpenTask?:(row:EncounterRow)=>void|Promise<void>;
  /** A fresh conversation in Tasks (New run… and Continue with). */
  onNewTask?:()=>void;
  /** Open the right panel's Run tape (Open activity). */
  onOpenActivity?:()=>void;
  onMessage?:(message:string)=>void;
}

/** Factory's centre (11-FACTORY §1): full-page, no pane tab bar. Desk is for
 * the work — the run board, then a run's own page replacing it with ← Desk,
 * then object pages in place with ← back; Tasks is for talking about it — the
 * selected conversation at full size, with a Run chip only when its session
 * truly carried the run (F14), else "Direct conversation" once (F15). */
export function FactoryCentre({chat,project,accompanying,onOpenTask,onNewTask,onOpenActivity,onMessage}:FactoryCentreProps) {
  const view=useCentreView();
  const openKey=useOpenRun();
  const object=useObjectPage();
  useDeskReading();
  const [debugOpen,setDebugOpen]=useState(false);
  const joined=view==="tasks"&&accompanying?runForSession(accompanying.ref):undefined;

  // The right panel answers about the selected run: in Tasks, the joined run
  // (a Direct conversation clears it); on the Desk, the run held open.
  useEffect(()=>{ if(view==="tasks")selectRun(joined?.card.key); },[view,joined?.card.key]);
  // A run opened (or closed) starts a fresh object stack.
  useEffect(()=>{ clearObjectPages(); },[openKey]);

  const openConversation=(sessionRef:string,spaceRef?:string,runProject?:string)=>{
    const row:EncounterRow={ref:sessionRef,space:spaceRef??"",title:"Conversation",project:runProject??project??"Central"};
    void onOpenTask?.(row);
  };
  const host:RunPageHost={
    onOpenConversation:onOpenTask?(sessionRef=>{
      const entry=runEntry(openKey);
      const attempt=entry?.inspection?.attempts?.find(item=>item.body?.agentSessionRef===sessionRef);
      openConversation(sessionRef,attempt?.body?.sessionSpaceRef,entry?.card.source.project);
    }):undefined,
    onStartConversation:onNewTask?(()=>{onNewTask();publishCentreView("tasks");}):undefined,
    onOpenActivity:onOpenActivity?(()=>onOpenActivity()):undefined,
    onOpenObject:(ref:FactoryObjectRef)=>openObjectPage(ref),
    onMessage,
  };

  const openRunFromTask=()=>{ if(!joined)return; openRunPage(joined.card.key); publishCentreView("desk"); };

  return <main className={"factory-centre"+(view==="tasks"?" factory-tasks":"")} aria-label="Factory" data-centre-view={view}>
    {view==="tasks"
      ? <section className="factory-chat-full" aria-label="Task conversation">
        <header className="factory-chat-context ftasks-head">
          {joined
            ? <button type="button" className="ftasks-runchip" data-run-chip={joined.run.runRef} title={`${RUN_STATE_WORD[joined.card.state]} · ${joined.card.title}`} onClick={openRunFromTask}>
              <span className="ftasks-runchip-kind">Run</span><span>{joined.card.title}</span>
            </button>
            : accompanying
              ? <span className="factory-chat-context-direct" data-direct-conversation>Direct conversation</span>
              : <span className="factory-chat-context-direct">New conversation</span>}
        </header>
        <div className="factory-chat-host">{chat}</div>
      </section>
      : object
        ? <FactoryObjectPage object={object} onBack={closeObjectPage} host={host}/>
        : openKey
          ? <RunPage runKey={openKey} onBack={closeRunPage} host={host}/>
          : <Desk onNewRun={onNewTask?()=>{onNewTask();publishCentreView("tasks");}:undefined}/>}
    {import.meta.env.DEV&&view==="desk"&&!openKey&&!object&&<details className="factory-centre-debug" onToggle={event=>setDebugOpen((event.target as HTMLDetailsElement).open)}>
      <summary>Debug: development console</summary>
      {debugOpen&&<FactoryDevelopmentSurface/>}
    </details>}
  </main>;
}
