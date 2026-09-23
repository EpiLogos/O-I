/**
 * Factory's left body (10-SIDEBARS §3.2): destinations Desk · Tasks, then
 *
 *   TASKS    the scope's conversations as rows with their live session
 *            marks; choosing one takes the centre to the Tasks view (§3.5 —
 *            Factory chats live in the centre, never the side tab group)
 *   INTENT   the scoped project's vision, goals and learnings (ruling D5)
 *
 * The scope is the one scope (§3.6), chosen in the head's scope menu — this
 * body has no project picker, refresh pill, provider pill or "Elsewhere"
 * line of its own any more (the scope menu carries per-project activity
 * marks; the provider lives on the composer's chips). Nothing here says
 * "returns": material waiting for judgement is in the Inbox (ruling 7, D3).
 */
import {useKernel} from "../../kernel/KernelProvider";
import {Glyph} from "../../workspace/Glyph";
import type {EncounterRow} from "../../encounter/EncounterList";
import {publishCentreView, useCentreView} from "../../contributions/factory/desk/deskModel";
import {useScope} from "../../workspace/scope";
import {Section, type SectionState} from "../../workspace/left/rows";
import {ChatRows, useConversations} from "../../workspace/left/ChatRows";
import {IntentSection} from "../../workspace/left/IntentSection";
import "./factory-navigator.css";

type View = "desk" | "tasks";

export function FactoryNavigator({onOpenEncounter, activeEncounterRef}: {
  project?: string;
  accompanying?: {ref: string; project: string; space: string};
  onProjectChange?: (project?: string) => void;
  onOpenEncounter: (row: EncounterRow) => Promise<void>;
  activeEncounterRef?: string;
  onMessage?: (message: string) => void;
}) {
  const kernel = useKernel();
  const scope = useScope();
  const centreView = useCentreView();
  const projects = kernel.snapshot.navigator?.root?.work.projects ?? [];
  // The scope's register: a Work project, Central's root (""), or — for
  // Factory's All projects — every project's tasks in one list.
  const registers: {project: string; label: string}[] = scope.kind === "project" ? [{project: scope.project, label: scope.project}]
    : scope.kind === "all" ? projects.map(entry => ({project: entry.name, label: entry.name}))
    : [{project: "", label: "Central"}];
  const choose = (next: View) => publishCentreView(next);
  const open = (row: EncounterRow) => {
    publishCentreView("tasks");
    void onOpenEncounter(row);
  };
  return <nav className="factory-navigator left-factory-body" aria-label="Factory">
    <div className="factory-views left-destinations" role="radiogroup" aria-label="Factory view">
      <button type="button" className="left-row left-destination" role="radio" aria-checked={centreView === "desk"} aria-current={centreView === "desk" ? "true" : undefined} onClick={() => choose("desk")}><Glyph name="grid" size={14}/><span className="left-row-label">Desk</span></button>
      <button type="button" className="left-row left-destination" role="radio" aria-checked={centreView === "tasks"} aria-current={centreView === "tasks" ? "true" : undefined} onClick={() => choose("tasks")}><Glyph name="chat" size={14}/><span className="left-row-label">Tasks</span></button>
    </div>
    <TasksSection registers={registers} activeRef={activeEncounterRef} onOpen={open}/>
    {scope.kind !== "all" && <IntentSection project={scope.kind === "project" ? scope.project : undefined}/>}
  </nav>;
}

/** TASKS: the scope's conversations. With several registers (All projects)
 * each keeps its own reading and its own honest state. */
function TasksSection({registers, activeRef, onOpen}: {registers: {project: string; label: string}[]; activeRef?: string; onOpen: (row: EncounterRow) => void}) {
  if (registers.length === 1) return <SingleTasks register={registers[0]} activeRef={activeRef} onOpen={onOpen}/>;
  return <Section id="tasks" label="Tasks" state={{kind: "ready", rows: registers.length}}>
    {registers.map(register => <RegisterTasks key={register.project} register={register} activeRef={activeRef} onOpen={onOpen}/>)}
  </Section>;
}

function SingleTasks({register, activeRef, onOpen}: {register: {project: string; label: string}; activeRef?: string; onOpen: (row: EncounterRow) => void}) {
  const {state, retry} = useConversations(register.project);
  const section: SectionState = state.kind === "loading" ? {kind: "loading", what: `Reading ${register.label}…`}
    : state.kind === "error" ? {kind: "error", message: "Couldn't load this project.", onRetry: retry}
    : state.kind === "stale" ? {kind: "stale", rows: state.rows.length, since: state.since, onRetry: retry}
    : {kind: "ready", rows: state.rows.length};
  return <Section id="tasks" label="Tasks" count={state.kind === "ready" || state.kind === "stale" ? state.rows.length : undefined} state={section}>
    <ChatRows project={register.project} label={register.label} state={state} retry={retry} activeRef={activeRef} kind="Task" onOpen={onOpen} staleInHeader/>
  </Section>;
}

function RegisterTasks({register, activeRef, onOpen}: {register: {project: string; label: string}; activeRef?: string; onOpen: (row: EncounterRow) => void}) {
  const {state, retry} = useConversations(register.project);
  if (state.kind === "ready" && !state.rows.length) return null;
  return <div className="left-register" data-register={register.project}>
    <span className="left-subhead">{register.label}</span>
    <ChatRows project={register.project} label={register.label} state={state} retry={retry} activeRef={activeRef} kind="Task" onOpen={onOpen}/>
  </div>;
}
