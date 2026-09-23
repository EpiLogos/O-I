import {useEffect, useRef, useState, type ReactNode} from "react";
import {FACTORY_OBJECT_KINDS} from "./objectKinds";
import {FactoryDevelopmentSurface} from "./FactoryDevelopmentSurface";
import type {EncounterRow} from "../../encounter/EncounterList";
import {Desk} from "./desk/Desk";
import {RunPage, type FactoryObjectRef, type RunPageHost} from "./desk/RunPage";
import {ObjectPage} from "../../agent/objects";
import {OPEN_OBJECT_EVENT, isOpenObjectDetail} from "../../agent/objects/registry";
import {factoryObject} from "./desk/factoryObjects";
import {publishCentreView, useCentreView} from "./desk/deskModel";
import {closeRunPage, openRunPage, peekDeskReading, runEntry, runsForSession, selectRun, useDeskReading, useOpenRun} from "./desk/deskStore";
import {RUN_STATE_WORD} from "./desk/runModel";
import {clearObjectPages, closeObjectPage, openObjectPage, useObjectPage} from "./desk/objectNav";
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
  /** A fresh conversation in Tasks (New run…). */
  onNewTask?:()=>void;
  /** Open the right panel's Run tape (Open activity). */
  onOpenActivity?:()=>void;
  onMessage?:(message:string)=>void;
}

/** Every run the Desk holds, as the registry identities need them. */
function heldRuns() {
  return Object.values(peekDeskReading()?.runs ?? {}).map(entry => ({runKey: entry.card.key, statePath: entry.card.source.statePath, runRef: entry.run.runRef, title: entry.card.title, project: entry.card.source.project}));
}
const FACTORY_KINDS = FACTORY_OBJECT_KINDS;

/** Factory's centre (11-FACTORY §1): full-page, no pane tab bar. Desk is for
 * the work — the run board, then a run's own page replacing it with ← Desk,
 * then object pages in place with ← back; Tasks is for talking about it — the
 * selected conversation at full size, with a Run chip only when its session
 * truly carried the run (F14), else "Direct conversation" once (F15). */
export function FactoryCentre({chat,accompanying,onOpenTask,onNewTask,onOpenActivity,onMessage}:FactoryCentreProps) {
  const view=useCentreView();
  const openKey=useOpenRun();
  const object=useObjectPage();
  useDeskReading();
  const [debugOpen,setDebugOpen]=useState(false);
  const centre=useRef<HTMLElement>(null);
  // F14/F15 + ambiguity: a conversation joins a run only when exactly one
  // read run carried its session; several is shown as such, never the first.
  const join=view==="tasks"&&accompanying?runsForSession(accompanying.ref):undefined;
  const joined=join?.outcome==="one"?join.entries[0]:undefined;
  const ambiguousRuns=join?.outcome==="ambiguous"?join.entries:[];

  // The right panel answers about the selected run: in Tasks, the joined run
  // (a Direct conversation clears it); on the Desk, the run held open.
  useEffect(()=>{ if(view==="tasks")selectRun(joined?.card.key); },[view,joined?.card.key]);
  // A run opened (or closed) starts a fresh object stack.
  useEffect(()=>{ clearObjectPages(); },[openKey]);
  // Object pages open IN PLACE in this full-page centre (§4.1a): a Factory
  // kind (or a tape event) asked for without Pop out lands on the stack.
  // Pop out is the frame's (its own window, the same identity).
  useEffect(()=>{
    const onOpen=(event:Event)=>{
      const detail=(event as CustomEvent).detail;
      // Only while this centre is the one presented (a retained, hidden
      // Factory centre never takes another mode's opens).
      if(!centre.current||centre.current.offsetParent===null)return;
      if(!isOpenObjectDetail(detail)||detail.popOut||!FACTORY_KINDS.has(detail.object.kind))return;
      publishCentreView("desk");
      openObjectPage(detail.object);
    };
    window.addEventListener(OPEN_OBJECT_EVENT,onOpen);
    return()=>window.removeEventListener(OPEN_OBJECT_EVENT,onOpen);
  },[]);

  const openConversation=(sessionRef:string,spaceRef?:string,runProject?:string)=>{
    const row:EncounterRow={ref:sessionRef,space:spaceRef??"",title:"Conversation",project:runProject??""};
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
    onOpenObject:(ref:FactoryObjectRef)=>openObjectPage(factoryObject(ref,heldRuns())),
    onMessage,
  };

  const openRunFromTask=(key=joined?.card.key)=>{ if(!key)return; openRunPage(key); publishCentreView("desk"); };

  return <main ref={centre} className={"factory-centre"+(view==="tasks"?" factory-tasks":"")} aria-label="Factory" data-centre-view={view}>
    {view==="tasks"
      ? <section className="factory-chat-full" aria-label="Task conversation">
        <header className="factory-chat-context ftasks-head">
          {joined
            ? <button type="button" className="ftasks-runchip" data-run-chip={joined.run.runRef} title={`${RUN_STATE_WORD[joined.card.state]} · ${joined.card.title}`} onClick={()=>openRunFromTask()}>
              <span className="ftasks-runchip-kind">Run</span><span>{joined.card.title}</span>
            </button>
            : ambiguousRuns.length
              ? <span className="ftasks-ambiguous" data-run-join="ambiguous" role="status">
                <span>This conversation carried {ambiguousRuns.length} runs — choose one:</span>
                {ambiguousRuns.map(entry=><button key={entry.card.key} type="button" className="ftasks-runchip" data-run-chip={entry.run.runRef} title={`${RUN_STATE_WORD[entry.card.state]} · ${entry.card.title}`} onClick={()=>openRunFromTask(entry.card.key)}>
                  <span className="ftasks-runchip-kind">Run</span><span>{entry.card.title}</span>
                </button>)}
              </span>
            : accompanying
              ? <span className="factory-chat-context-direct" data-direct-conversation>Direct conversation</span>
              : <span className="factory-chat-context-direct">New conversation</span>}
        </header>
        <div className="factory-chat-host">{chat}</div>
      </section>
      : object
        ? <div className="frun fobject" data-object-page={object.kind}><ObjectPage key={`${object.kind}|${object.ref}`} object={object} onBack={closeObjectPage}/></div>
        : openKey
          ? <RunPage runKey={openKey} onBack={closeRunPage} host={host}/>
          : <Desk onNewRun={onNewTask?()=>{onNewTask();publishCentreView("tasks");}:undefined}/>}
    {import.meta.env.DEV&&view==="desk"&&!openKey&&!object&&<details className="factory-centre-debug" onToggle={event=>setDebugOpen((event.target as HTMLDetailsElement).open)}>
      <summary>Debug: development console</summary>
      {debugOpen&&<FactoryDevelopmentSurface/>}
    </details>}
  </main>;
}
