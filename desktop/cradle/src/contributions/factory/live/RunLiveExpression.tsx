/**
 * The Run's Live presentation (FX-C2/C3; spec §5): the Run performed through
 * the Expressions engine. The Run's own Expression (cast, goal, work — see
 * run-expression.ts) is opened in the kernel and hosted by the Expressions
 * application (PointCloudHost, the one host); FactoryLive's producer follows
 * the Run's native events and performs them into the Run's act. Beneath the
 * stage: the act's timeline (performed passages; selecting one re-performs
 * it through `act_seek`) and the legs/attempts table as before.
 *
 * Selecting an object opens its native page in the existing sidebar — an
 * agent's work, capabilities, conversation and communication with its
 * actions; the goal's brief and progress; an artifact's details; an
 * exchange's message — every action on an existing route.
 */
import {useCallback, useEffect, useRef, useState, type ReactNode} from "react";
import {useKernel} from "../../../kernel/KernelProvider";
import {PointCloudHost} from "../../../expressions/PointCloudHost";
import {type HostedAppState} from "../../../expressions/hostedApp";
import type {RunEntry} from "../desk/deskStore";
import type {RunPageHost} from "../desk/RunPage";
import {readAgentCard} from "../../../agency/agentCardReading";
import {followRunLive, selectRunExpression, useRunLive} from "../FactoryLive";
import {readAndComposeRunExpression} from "../run-expression";
import {actSeek, type WorldAct} from "../../../expression/world";
import {decodeBasis} from "./eventMap";
import {liveExpressionRefFor, type PerformedPassage} from "./producer";
import {ensureExpression} from "./liveObjects";
import {openObject} from "../../../agent/objects/registry";
import {liveSubjectObject} from "./RunLiveObject";
import "./live.css";

const FAMILY_WORD: Record<string, string> = {
  arrival: "arrives", activity: "works", "skill-invocation": "skill", "tool-operation": "tool", message: "message",
  artifact: "result", review: "review", continuation: "continues", completion: "completes",
};

export function RunLiveExpression({entry, runKey, host, children}: {entry: RunEntry; runKey: string; host: RunPageHost; children?: ReactNode}) {
  const kernel = useKernel();
  const {card, run} = entry;
  const expressionRef = liveExpressionRefFor(run.runRef);
  const [ready, setReady] = useState<"opening" | "ready" | "refused">("opening");
  const [reason, setReason] = useState<string>();
  const stage = useRef<HTMLDivElement>(null);
  const live = useRunLive(runKey);
  const project = card.source.project;

  // Open the Run's Expression, then hold the live follow while shown.
  useEffect(() => {
    let alive = true;
    let release: (() => void) | undefined;
    void (async () => {
      try {
        const readCard = (agentRef: string) => readAgentCard(kernel.transport, agentRef);
        await ensureExpression(kernel.transport, () => readAndComposeRunExpression(kernel.transport, card.source.statePath, run.runRef, expressionRef, undefined, undefined, readCard), "desktop:factory-live");
        if (!alive) return;
        setReady("ready");
        release = followRunLive(kernel.transport, {runKey, runRef: run.runRef, statePath: card.source.statePath, project, goal: run.destination ?? card.title, units: entry.inspection?.units});
      } catch (error) {
        if (alive) { setReady("refused"); setReason(error instanceof Error ? error.message : String(error)); }
      }
    })();
    return () => { alive = false; release?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey, kernel.transport]);

  // Each performed passage changes the target Expression in the kernel; the
  // hosted application re-reads it (its own refresh-expression command).
  const [seeks, setSeeks] = useState(0);
  // The act as a timeline seek left it (its position names the passage on
  // stage); a newly performed passage supersedes it.
  const [sought, setSought] = useState<WorldAct>();
  const stageAct = sought && live?.act && sought.act_ref === live.act.act_ref && sought.revision >= live.act.revision ? sought : live?.act;
  const performedCount = (live?.performed.filter(passage => passage.state === "performed").length ?? 0) + seeks;

  // The application opens the Run's Expression once the act has performed
  // into it (or the first follow pass found nothing to perform): opened
  // earlier, the bare composed Scene becomes an application-side working
  // draft that then refuses to follow the act's own revisions.
  const staged = !!live && ((live.act?.sequence?.length ?? 0) > 0 || live.lastPassAt !== undefined || live.status === "refused");
  const lastAnnounced = useRef<string>("[]");
  const onHostedState = useCallback((state: HostedAppState) => {
    const native=state.nativeScene,chosen=state.selection?.[0];
    if(native?.expression_ref!==expressionRef)return;
    const announced=JSON.stringify([native.scene_ref,(state.selection??[]).map(item=>item.id)]);
    if(announced===lastAnnounced.current)return;
    lastAnnounced.current=announced;
    if(!chosen)return;
    openObject(liveSubjectObject({statePath:card.source.statePath,projectRef:card.source.projectRef,runRef:run.runRef,expressionRef,sceneRef:native.scene_ref,entityRef:chosen.id},chosen.name??"Selected subject",project),{placement:"sidebar"});
  }, [expressionRef,card.source.statePath,card.source.projectRef,run.runRef,project]);

  const seek = async (actRef: string, position: number) => {
    try {
      const outcome = await actSeek(kernel.transport, {act_ref: actRef, position, actor: "desktop:factory-live"});
      if (outcome && typeof outcome.state === "string" && /refus|conflict|unavailable/.test(outcome.state)) throw new Error(outcome.state);
      // The seek re-performed the passage into the Run's Expression: the
      // stage follows it like any performed passage.
      if (outcome?.act) setSought(outcome.act);
      setSeeks(n => n + 1);
    }
    catch (error) { host.onMessage?.(`That passage could not be re-performed: ${error instanceof Error ? error.message : String(error)}`); }
  };

  return <div className="flx" data-live-expression={expressionRef} data-live-status={live?.status ?? ready}>
    <div className="flx-stage" ref={stage}>
      {ready === "ready" && staged && <PointCloudHost mode="expressions" deepLink={expressionRef} followsOwnRef onHostedState={onHostedState} refreshToken={performedCount || undefined}/>}
      {(ready === "opening" || (ready === "ready" && !staged)) && <p className="frun-note" role="status">Opening the Run's Expression…</p>}
      {ready === "refused" && <p className="frun-note" role="alert">The Run's Expression could not open: {reason}</p>}
      <LiveStrip entry={entry} live={live}/>
    </div>
    <ExpressionChoice live={live} onChoose={fileRef => void selectRunExpression(runKey, fileRef).catch(error => host.onMessage?.(`That Expression could not be selected: ${error instanceof Error ? error.message : String(error)}`))}/>
    <Timeline passages={live?.performed ?? []} act={stageAct} chain={live?.chain ?? []} onSeek={(actRef, position) => void seek(actRef, position)}/>
    {children}
  </div>;
}

/** Tier 1 of the repertoire: the person chooses the Expression (or Scene)
 * this Run performs; "Automatic" returns to workflow → task → generic. */
function ExpressionChoice({live, onChoose}: {live: ReturnType<typeof useRunLive>; onChoose: (fileRef: string | undefined) => void}) {
  const choices = live?.choices ?? [];
  if (!choices.length) return null;
  const current = live?.repertoire?.basis === "explicit" ? live.repertoire.expression?.file_ref ?? "" : "";
  return <label className="flx-choice">
    <span>Expression</span>
    <select value={current} onChange={event => onChoose(event.target.value || undefined)} aria-label="Expression this Run performs">
      <option value="">Automatic{live?.repertoire?.expression && live.repertoire.basis !== "explicit" ? ` — ${live.repertoire.expression.title}` : ""}</option>
      {choices.map(choice => <option key={choice.file_ref} value={choice.file_ref}>{choice.title}{choice.kind === "scene" ? " (Scene)" : ""}</option>)}
    </select>
  </label>;
}

function LiveStrip({entry, live}: {entry: RunEntry; live: ReturnType<typeof useRunLive>}) {
  const unavailable = Object.entries(live?.sources ?? {}).filter(([, state]) => state === "unavailable").map(([name]) => name.replace(/^journal:.*$/, "a journal").replace(/^card:.*$/, "an Agent card"));
  const words = live?.repertoire?.basis === "none" ? "no repertoire material is available yet" : live?.repertoire?.expression ? `${live.repertoire.expression.title} (${live.repertoire.basis})` : "reading the repertoire";
  return <p className="flx-strip" data-live-repertoire={live?.repertoire?.basis ?? "reading"}>
    <span>{live?.status === "following" ? "● following" : live?.status ?? "opening"}</span>
    <span> · {entry.card.title}</span>
    <span> · {words}</span>
    {live?.error && <span role="alert"> · {live.error}</span>}
    {[...new Set(unavailable)].length > 0 && <span className="flx-strip-absent"> · unavailable: {[...new Set(unavailable)].join(", ")}</span>}
  </p>;
}

/** The act's passages: the kernel's sequence when read, else what this view
 * performed. Selecting a passage re-performs it (`act_seek`). */
function Timeline({passages, act, chain, onSeek}: {passages: PerformedPassage[]; act?: WorldAct; chain: WorldAct[]; onSeek: (actRef: string, position: number) => void}) {
  // The Run's act chain (rolled over at the passage cap), oldest first.
  const acts = [...chain, ...(act ? [act] : [])].filter(candidate => candidate.sequence?.length);
  const rows = acts.length
    ? acts.flatMap(owner => owner.sequence.map(passage => ({key: `${owner.act_ref}#${passage.index}`, actRef: owner.act_ref, index: passage.index, family: passage.event_basis?.family ?? passage.kind,
      words: passage.summary ?? passage.text ?? passage.gesture ?? (passage.state ? `${passage.role ?? ""} ${passage.state}`.trim() : undefined) ?? decodeBasis(passage.event_basis)?.entry ?? passage.kind, state: "performed" as const,
      current: owner === act && act.position === passage.index})))
    : passages.map((passage, index) => ({key: passage.key, actRef: undefined as string | undefined, index, family: passage.op.basis.family, words: "scene" in passage.op ? passage.op.scene : passage.op.operation === "act_text" ? passage.op.text : passage.op.operation === "act_gesture" ? passage.op.skill ?? passage.op.gesture : passage.op.state, state: passage.state, current: false}));
  if (!rows.length) return <p className="flx-timeline-empty">No passages performed yet.</p>;
  return <ol className="flx-timeline" aria-label="Performed passages">
    {rows.slice(-60).map(row => <li key={row.key} data-family={row.family} data-state={row.state} data-act-ref={row.actRef} data-position={row.index} aria-current={row.current ? "step" : undefined}>
      <button type="button" disabled={!row.actRef} onClick={() => row.actRef && onSeek(row.actRef, row.index)} title={row.state === "performed" ? "Re-perform this passage" : row.state}>
        <span className="flx-family">{FAMILY_WORD[row.family] ?? row.family}</span> <span className="flx-words">{String(row.words).slice(0, 60)}</span>
      </button>
    </li>)}
  </ol>;
}
