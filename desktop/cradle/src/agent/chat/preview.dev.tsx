import {useMemo,useState} from "react";
import type {EncounterReading,EncounterStatus} from "../../encounter/client";
import type {EncounterSessionHandle,EncounterSessionState} from "../../encounter/session";
import {CONTEXT_MARK} from "../../context/contextItems";
import {AgentChat} from "./AgentChat";
import type {AgentIdentityReading} from "./AgentIdentity";

/**
 * THE DEVELOPER PREVIEW — the production chat components over fixture state.
 * Reached from the chat's History menu or the panel head menu (dev builds
 * only). It exists so the panel's real density, scrolling, composer and
 * states can be judged at 320 / 400 / 520 px in light and dark WITHOUT a
 * loaded conversation, a provider, or any native call: nothing here touches
 * the session store, history, or the kernel — every action is a local
 * fixture mutation, and the fixture identity stands in for the profile read.
 * This module is dev-only and dynamically imported; production bundles never
 * carry it.
 */

const IDENTITY:AgentIdentityReading={name:"Anima",ref:"profile:fixture",description:"Fixture profile — the preview makes no profile read",state:"read"};

type PreviewExample="empty"|"populated"|"streaming"|"approval"|"error";

const EXAMPLES:{id:PreviewExample;label:string}[]=[
  {id:"empty",label:"New conversation"},
  {id:"populated",label:"Populated"},
  {id:"streaming",label:"Streaming · tool use"},
  {id:"approval",label:"Approval"},
  {id:"error",label:"Error · offline"},
];

const contextBlock=(title:string,origin:string,quote:string):string=>`${CONTEXT_MARK}${title} · ${origin} · revision rev-fixt-7\n${quote.split("\n").map(line=>`> ${line}`).join("\n")}`;

let blockId=0;
const block=(kind:string,text:string)=>({id:++blockId,kind,text});

const SOURCE=contextBlock("AgentChat.tsx","source/agent/chat/AgentChat.tsx","The clean chat face of the accompanying agent");

const DRAFT_WITH_CHIPS=`${SOURCE}\n\nSummarise what this component owes the panel.`;

const populated=():{reading:EncounterReading;status:EncounterStatus}=>{
  blockId=0;
  return {reading:{
    schema:"aikit.encounter-view/v1",agent_session:"agent-session/fixture",more:false,
    draft:{revision:4,text:DRAFT_WITH_CHIPS},
    actions:[
      {ref:"aikit.encounter.draft",enabled:true,reason:null},
      {ref:"aikit.encounter.prompt",enabled:true,reason:null},
      {ref:"aikit.encounter.cancel",enabled:true,reason:null},
      {ref:"aikit.encounter.permission",enabled:true,reason:null},
      {ref:"aikit.encounter.open",enabled:true,reason:null},
    ],
    blocks:[
      block("user",`${contextBlock("shell.css","source/workspace/shell.css",".desktop-side.right.depth-panel, .desktop-side.right.depth-full")}\n\nWhere does the right region take its ground from?`),
      block("thinking","The person is asking about the shell vocabulary; the quoted selector is the right region's placement rule."),
      block("tool","shell.read — source/workspace/shell.css · returned 42 lines"),
      block("assistant","The right region reads `--oi-agent-ground` — the accompanying-agent plane token set in the shell vocabulary. The region sits on the shell ground with its own hairline card edge, so it reads as one plane beside the centre panes rather than a page of its own.\n\nTwo details carry the separation:\n\n- the gutter margin (`--oi-shell-gutter`) offsets the card from the centre;\n- the hairline (`--oi-hairline`) draws the card edge, never a heavier rule."),
      block("completed","turn complete"),
      block("user","Thank you — now the transcript: keep the composer anchored to the panel."),
      block("assistant","Understood. The composer is a flex child of the chat column: the transcript scrolls, the composer never leaves. At every panel width from 320 px upward the composer stays visible, growing from three lines to a bounded height; the transcript owns whatever room remains.\n\nThe panel shell is independent of a loaded conversation — with nothing bound the same composer edits the parked draft, so drafting never waits for a session or a provider.\n\nHere is the shape in full, since the density matters when judging it:\n\nThe transcript keeps one independently scrolling column of turns. A user turn is a quiet surface with its attached context as chips above the words. An assistant turn is unboxed prose with lists and fenced code, streamed at a reading pace while the owner reports the turn in flight. Working material — thinking, tool calls, notices — folds into one quiet expandable row between turns, each row carrying its actual status; the detail is one click away and never pushes the conversation around. When the reader scrolls up, the view stops following and a small jump control waits at the edge instead of yanking the column back. Copy sits where reading happens: on code blocks and on whole turns. A sent message can return to the composer as an edit, the recording untouched.\n\n```ts\nexport function useEncounterSession(binding: EncounterSessionBinding | undefined) {\n  const session = useMemo(\n    () => project && ref ? acquire(kernel.transport, { project, ref, space }) : undefined,\n    [kernel.transport, project, ref],\n  );\n  useEffect(() => { if (!session) return; session.retain(); return () => session.release(); }, [session]);\n  return useSyncExternalStore(session?.subscribe ?? noop, session?.snapshot ?? noSnapshot);\n}\n```\n\nThe one session observer is shared by every presenter of the same conversation — the centre tab and this panel read one store entry, one poll loop, one canonical draft."),
      block("completed","turn complete"),
    ],
  },status:{state:"Connected",provider:{id:"fixture-acp",label:"Fixture ACP"},native_session_id:"native-fixture-1"}};
};

const streaming=()=>{const made=populated();made.status={state:"TurnInFlight",provider:{id:"fixture-acp",label:"Fixture ACP"},native_session_id:"native-fixture-1"};made.reading.blocks.push(
  block("user","Walk the planes for me — what does Activity hold that the transcript folds away?"),
  block("thinking","Comparing the folded working rows with the Activity plane's full journal reading."),
  block("tool","journal.read — after cursor 12 · returned 9 events"),
  block("assistant","Activity is the full ledger; the transcript folds only what serves reading. Between turns you saw one quiet row — \u201C1 thinking · 1 tool\u201D — expandable in place. Activity shows the same events with their block ids, the delivery history, and the journal beneath, none of which the conversation needs inline."),
);return made;};

const approval=()=>{const made=populated();made.status={state:"Connected",provider:{id:"fixture-acp",label:"Fixture ACP"},native_session_id:"native-fixture-1"};
  made.reading.blocks.push(block("user","Run the suite and paste the failing test's output."),block("tool","suite.run — cargo test --workspace · in flight"));
  made.reading.permissions=[{native_request_id:"req-fixture-1",native_session_id:"native-fixture-1",tool_call:"workspace.write — /Users/admin/Work/O-I/desktop/cradle/src/agent/chat/chat.css",raw:{},choices:[{option_id:"allow",label:"Allow once",kind:"allow"},{option_id:"allow_all",label:"Allow for this session",kind:"allow"},{option_id:"deny",label:"Deny",kind:"deny"}],provenance:["fixture"]}];return made;};

const errored=()=>{const made=populated();made.status={state:"Disconnected",provider:{id:"fixture-acp",label:"Fixture ACP"},native_session_id:"native-fixture-1",error:"The provider's resident exited before the turn completed."};
  made.reading.blocks.push(block("user","Continue the refactor from where it stopped."),block("error","connection closed while the turn was in flight — no text was recorded"));return made;};

/** A fixture observer: the real handle shape, every action a local no-op or
 * a local draft edit. No kernel transport exists on this path. */
const fixtureSession=(reading:EncounterReading,status:EncounterStatus,draft:string):EncounterSessionHandle=>{
  const state:EncounterSessionState={
    key:"fixture:agent-session/fixture",project:"Fixture",agentSession:"agent-session/fixture",
    reading,status,providers:[{id:"fixture-acp",label:"Fixture ACP"}],
    model:{phase:"unavailable",error:"This dev preview has no native model owner."},
    draft,pending:false,busy:false,draftFailed:false,
    dispatch:{kind:"idle"},deliveries:[],a2a:{busy:false},
  };
  const actions={
    allowed:(name:string)=>reading.actions?.some(action=>action.ref===`aikit.encounter.${name}`&&action.enabled)===true,
    change:(text:string)=>setFixtureDraft(text),
    readModel:async()=>{},selectModel:async()=>{throw new Error("No native selector exists in this dev preview");},refreshProviders:async()=>{},
    send:async()=>{},recover:async()=>{},connect:async()=>{},reconnect:async()=>{},cancel:()=>{},
    permission:async()=>{},earlier:()=>{},latest:()=>{},
    readJournal:async(after:number)=>({agent_session:"agent-session/fixture",events:[],next_cursor:after,more:false}),
    sendAddressed:async()=>{},sendGroup:async()=>{},seedA2a:()=>{},sendA2a:async()=>{},
  };
  return {state,actions};
};

let setFixtureDraft:(text:string)=>void=()=>{};

/** The preview's own frame: example, width and appearance controls above the
 * production components at the chosen panel width. */
export function ChatPreview({onClose}:{onClose:()=>void}) {
  const [example,setExample]=useState<PreviewExample>("populated");
  const [width,setWidth]=useState(400);
  const [dark,setDark]=useState(false);
  const [draft,setDraft]=useState<string|null>(null);
  setFixtureDraft=setDraft;
  const made=useMemo(()=>example==="streaming"?streaming():example==="approval"?approval():example==="error"?errored():populated(),[example]);
  /** Rebuilt per example and per fixture edit: the composer's typing lands
   * back in the fixture draft, nowhere else. An example change resets the
   * draft to that example's own. */
  const session=useMemo(()=>example==="empty"?undefined:fixtureSession(made.reading,made.status,draft??made.reading.draft.text),[example,made,draft]);
  return <div className="chat-preview">
    <div className="chat-preview-bar" role="toolbar" aria-label="Preview controls">
      <span className="oi-eyebrow">Fixture — no native calls</span>
      <span className="chat-preview-group">Example{EXAMPLES.map(item=><button key={item.id} className="chat-preview-choice" aria-pressed={example===item.id} onClick={()=>{setExample(item.id);setDraft(null);}}>{item.label}</button>)}</span>
      <span className="chat-preview-group">Width{[320,400,520].map(value=><button key={value} className="chat-preview-choice" aria-pressed={width===value} onClick={()=>setWidth(value)}>{value}</button>)}</span>
      <span className="chat-preview-group">Appearance<button className="chat-preview-choice" aria-pressed={!dark} onClick={()=>setDark(false)}>Light</button><button className="chat-preview-choice" aria-pressed={dark} onClick={()=>setDark(true)}>Dark</button></span>
      <button className="oi-action chat-preview-close" onClick={onClose}>Close preview</button>
    </div>
    <div className="chat-preview-stage">
      <div className="oi-desktop" data-theme={dark?"dark":"light"} style={{width}}>
        <AgentChat session={session} accompanying={example==="empty"?undefined:{ref:"agent-session/fixture",project:"Fixture",space:"fixture"}}
          project="Fixture" agentName="Anima" situating="Fixture project" sessionTitle="Judging the panel at its real widths"
          choosing={false}
          subject={{title:"AgentChat.tsx"}} fixture identity={IDENTITY} onNewChat={()=>setExample("empty")}/>
      </div>
    </div>
  </div>;
}
