/**
 * The Run's Live presentation (FX-C2/C3; spec §5): the Run performed through
 * the Expressions engine. The Run's own Expression (cast, goal, work — see
 * run-expression.ts) is opened in the kernel and hosted by the Expressions
 * application (PointCloudHost, the one host); FactoryLive's producer follows
 * the Run's native events and performs them into the Run's act. Beneath the
 * stage: the act's timeline (performed passages; selecting one re-performs
 * it through `act_seek`) and the legs/attempts table as before.
 *
 * Selecting an object in the scene opens a compact panel over it — an
 * agent's work, capabilities, conversation and communication with its
 * actions; the goal's brief and progress; an artifact's details; an
 * exchange's message — every action on an existing route.
 */
import {useCallback, useEffect, useMemo, useRef, useState, type ReactNode} from "react";
import {useKernel} from "../../../kernel/KernelProvider";
import {PointCloudHost} from "../../../expressions/PointCloudHost";
import {type HostedAppState} from "../../../expressions/hostedApp";
import type {ExpressionDocument} from "../../../expression/types";
import type {RunEntry} from "../desk/deskStore";
import type {RunPageHost} from "../desk/RunPage";
import {readAgentCard} from "../../../agency/agentCardReading";
import {followRunLive, selectRunExpression, useRunLive} from "../FactoryLive";
import {readAndComposeRunExpression} from "../run-expression";
import {actSeek, type WorldAct} from "../../../expression/world";
import {continueActInMode} from "../../../expression/crossModeAct";
import {decodeBasis} from "./eventMap";
import {actRefFor, liveExpressionRefFor, type PerformedPassage} from "./producer";
import {addressAgent, communicationOf, exchangeOf, openEncounterSurface, ensureExpression, inspectExpression, ownerActionWords, resolveLiveObject, type LiveObject} from "./liveObjects";
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
  const [selection, setSelection] = useState<{id: string; name?: string}>();
  const [document, setDocument] = useState<ExpressionDocument>();
  const [sceneRef, setSceneRef] = useState<string>();
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
    if (state.nativeScene?.expression_ref === expressionRef) setSceneRef(state.nativeScene.scene_ref);
    // Only a CHANGE of the frame's selection moves the panel: the frame
    // re-announces its (unchanged) state on every refresh as passages land,
    // and that must not close the panel the person opened.
    const chosen = state.selection?.[0];
    const announced = JSON.stringify((state.selection ?? []).map(item => item.id));
    if (announced === lastAnnounced.current) return;
    lastAnnounced.current = announced;
    setSelection(current => current?.id === chosen?.id ? current : chosen);
  }, [expressionRef]);

  // The selected object's document read (the kernel's copy, never the frame's).
  useEffect(() => {
    if (!selection) return;
    let alive = true;
    void inspectExpression(kernel.transport, expressionRef).then(read => { if (alive) setDocument(read); });
    return () => { alive = false; };
  }, [selection, expressionRef, kernel.transport, performedCount]);

  const object = useMemo(() => selection ? resolveLiveObject({entityRef: selection.id, name: selection.name, document, act: stageAct, performed: live?.performed ?? [], cast: live?.cast ?? [], sceneRef}) : undefined,
    [selection, document, live, sceneRef]);

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
      {object && <ObjectPanel object={object} entry={entry} runKey={runKey} host={host} performed={live?.performed ?? []} currentAct={live?.act?.act_ref} onClose={() => setSelection(undefined)}/>}
      <LiveStrip entry={entry} live={live}/>
    </div>
    <ExpressionChoice live={live} onChoose={fileRef => void selectRunExpression(runKey, fileRef).catch(error => host.onMessage?.(`That Expression could not be selected: ${error instanceof Error ? error.message : String(error)}`))}/>
    <Timeline passages={live?.performed ?? []} act={live?.act} chain={live?.chain ?? []} onSeek={(actRef, position) => void seek(actRef, position)}/>
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

function ObjectPanel({object, entry, runKey, host, performed, currentAct, onClose}: {object: LiveObject; entry: RunEntry; runKey: string; host: RunPageHost; performed: PerformedPassage[]; currentAct?: string; onClose: () => void}) {
  const kernel = useKernel();
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState<string>();
  const [confirming, setConfirming] = useState<string>();
  const attempts = entry.inspection?.attempts ?? [];
  const run = entry.run;
  // The chain's newest act (the Run's act rolls over at the passage cap).
  const actRef = currentAct ?? actRefFor(run.runRef);
  const liveRef = liveExpressionRefFor(run.runRef);
  // The Run's working constellation IS its Live Expression (who/what is
  // there); a unit that declares its own constellation (an `expression:`
  // subject) is developed there instead.
  const constellationOf = (unitRef?: string) => {
    const unit = (entry.inspection?.units ?? []).find(candidate => candidate.workflowUnitRef === unitRef) as {subjectRef?: string} | undefined;
    return unit?.subjectRef?.startsWith("expression:") ? unit.subjectRef : liveRef;
  };
  const carry = (to: "techne" | "expressions", expressionRef: string, instrumentRef?: string) => {
    void continueActInMode(kernel.transport, {act_ref: actRef, to, expression_ref: expressionRef, instrument_ref: instrumentRef ?? run.runRef, runKey,
      summary: `${to === "techne" ? "Develop in Technè" : "Shape in Expressions"}: ${object.label}`})
      .catch(error => setNote(`The act could not continue: ${error instanceof Error ? error.message : String(error)}`));
  };
  const crossMode = (unitRef?: string, instrumentRef?: string) => <>
    <button type="button" className="fdesk-link" onClick={() => carry("techne", constellationOf(unitRef), instrumentRef)}>Develop in Technè</button>
    <button type="button" className="fdesk-link" onClick={() => carry("expressions", liveRef, instrumentRef)}>Shape in Expressions</button>
  </>;

  let body: ReactNode = null;
  if (object.kind === "agent" && object.member) {
    const member = object.member;
    const current = [...attempts].reverse().find(attempt => member.attempt_refs.includes(attempt.attemptRef));
    const session = member.session_refs[member.session_refs.length - 1];
    const arrival = [...performed].reverse().find(passage => passage.op.basis.entry === "attempt.start" && passage.op.basis.event_ref === current?.attemptRef);
    const skills = (arrival?.op.basis.detail?.skills as string[] | undefined) ?? [];
    const capabilities = (arrival?.op.basis.detail?.capabilities as string[] | undefined) ?? [];
    const messages = communicationOf(performed, member.agent_ref);
    // Addressed turns (AIKit `send`): composed into the conversation's
    // addressed-request composer, where the sender and participation basis
    // are the person's explicit inputs; the shared draft is never touched.
    const address = (sourceRef: string, text: string) => {
      if (!session) { setNote("This agent has no conversation in this Run to address."); return; }
      addressAgent(session, sourceRef, text);
      // The addressed composer lives on the conversation's encounter surface.
      const space = current?.body?.sessionSpaceRef ?? attempts.find(attempt => attempt.body?.agentSessionRef === session)?.body?.sessionSpaceRef;
      if (space) openEncounterSurface({ref: session, project: entry.card.source.project ?? "", space, title: member.label});
      else host.onOpenConversation?.(session);
      setDraft("");
      setNote("Composed as an addressed request in the conversation — send it there.");
    };
    body = <>
      <p className="flx-panel-line">{current ? <>Working on <strong>{current.taskRef?.replace(/^.*[/:]/, "") ?? current.workflowUnitRef}</strong>{current.status ? ` · ${current.status.replace(/_/g, " ")}` : ""}</> : "No current attempt in this Run."}</p>
      {(skills.length > 0 || capabilities.length > 0) && <div className="flx-panel-block"><h5>Selected capabilities</h5><ul>
        {skills.map(skill => <li key={skill}><code>{skill}</code>{session && <button type="button" className="fdesk-link" onClick={() => address(skill, `Invoke ${skill} for ${current?.taskRef ?? "the current task"} (attempt ${current?.attemptRef ?? "none"}).`)}>Invoke</button>}</li>)}
        {capabilities.map(capability => <li key={capability}><code>{capability}</code></li>)}
      </ul></div>}
      {messages.length > 0 && <div className="flx-panel-block"><h5>Communication</h5><ul>{messages.map(passage => {
        const caption = passage.op.bindings.caption;
        return <li key={passage.key}>{caption?.kind === "text" ? caption.text : passage.op.basis.entry}</li>;
      })}</ul></div>}
      {session && <form className="flx-panel-message" onSubmit={event => { event.preventDefault(); if (draft.trim()) address(current?.attemptRef ?? member.agent_ref, draft.trim()); }}>
        <input value={draft} onChange={event => setDraft(event.target.value)} placeholder={`Message ${member.label}…`} aria-label={`Message ${member.label}`}/>
        <button type="submit" className="oi-action" disabled={!draft.trim()}>Compose</button>
      </form>}
      <div className="flx-panel-actions">
        {session && host.onOpenConversation && <button type="button" className="fdesk-link" onClick={() => host.onOpenConversation?.(session)}>Open conversation</button>}
        {session && host.onOpenActivity && <button type="button" className="fdesk-link" onClick={() => host.onOpenActivity?.({sessionRef: session})}>Open activity</button>}
        {current && <button type="button" className="fdesk-link" onClick={() => host.onOpenObject?.({kind: "attempt", runKey, attemptRef: current.attemptRef})}>Open working surface</button>}
        {current && crossMode(current.workflowUnitRef, current.attemptRef)}
        {!current && <button type="button" className="fdesk-link" onClick={() => host.onOpenObject?.({kind: "agent", ref: member.agent_ref, label: member.label})}>Open agent</button>}
      </div>
    </>;
  } else if (object.kind === "goal") {
    const legs = Object.values(entry.inspection?.legs ?? {});
    const returned = legs.filter(leg => leg.status === "returned").length;
    const progress = [...performed].reverse().find(passage => passage.op.operation === "act_text" && passage.op.role === "progressText");
    body = <>
      <p className="flx-panel-line">{entry.card.purpose ?? run.destination ?? entry.card.title}</p>
      <p className="flx-panel-line">{legs.length ? `${returned} of ${legs.length} units returned` : "No unit has started."}{progress?.op.operation === "act_text" ? ` · ${progress.op.text}` : ""}</p>
      <div className="flx-panel-actions">
        {host.onOpenInExpressions && <button type="button" className="fdesk-link" onClick={() => host.onOpenInExpressions?.(entry)}>Open in Expressions</button>}
        {crossMode()}
      </div>
    </>;
  } else if (object.kind === "exchange") {
    const message = exchangeOf(object, performed);
    body = <>
      <p className="flx-panel-meta" data-exchange-parties>{message?.sender ?? "?"} → {message?.recipient ?? "?"}{message?.state ? ` · ${message.state}` : ""}</p>
      <p className="flx-panel-line" data-exchange-body>{message?.body}</p>
      <p className="flx-panel-meta"><code data-exchange-ref>{message?.ref}</code></p>
    </>;
  } else {
    const subject = object.subjectRef;
    const attempt = attempts.find(candidate => candidate.return?.artifactRefs?.includes(subject ?? "") || candidate.workflowUnitRef === subject);
    const actions = (run.actions ?? []).filter(action => action.currentlyApplicable && subject && action.applicableSubjectRefs?.includes(subject));
    // The Run page's owner-action flow: an explicit confirmation, then the
    // owner's request stated with its real capability ref. The desktop holds
    // no grant and never asserts one.
    const request = (action: {actionRef: string; label: string; requiredCapabilityRef?: string; authorityOwner?: string}) => {
      if (confirming !== action.actionRef) { setConfirming(action.actionRef); return; }
      setConfirming(undefined);
      const words = ownerActionWords(action, subject);
      host.onMessage?.(words);
      setNote(words);
    };
    body = <>
      {subject && <p className="flx-panel-meta"><code>{subject}</code></p>}
      {attempt?.return?.summary && <p className="flx-panel-line">{attempt.return.summary}</p>}
      {(attempt?.return?.evidenceRefs ?? []).length > 0 && <p className="flx-panel-meta">evidence {attempt!.return!.evidenceRefs!.length}</p>}
      <div className="flx-panel-actions">
        {subject?.startsWith("workflow-unit:") && <button type="button" className="fdesk-link" onClick={() => host.onOpenObject?.({kind: "work-unit", runKey, unitRef: subject})}>Open working surface</button>}
        {attempt && !subject?.startsWith("workflow-unit:") && <button type="button" className="fdesk-link" onClick={() => host.onOpenObject?.({kind: "attempt", runKey, attemptRef: attempt.attemptRef})}>Open attempt</button>}
        {crossMode(subject?.startsWith("workflow-unit:") ? subject : attempt?.workflowUnitRef, attempt?.attemptRef ?? subject)}
        {actions.map(action => <button key={action.actionRef} type="button" className="fdesk-link" data-confirming={confirming === action.actionRef || undefined} onClick={() => request(action)}>{confirming === action.actionRef ? `Confirm: ${action.label}` : action.label}</button>)}
      </div>
    </>;
  }
  return <aside className="flx-panel" data-live-object={object.kind} aria-label={`${object.label} details`}>
    <header><span className="flx-panel-kind">{object.kind === "other" ? object.role ?? "object" : object.kind}</span><strong>{object.label}</strong>
      <button type="button" className="flx-panel-close" aria-label="Close" onClick={onClose}>×</button></header>
    {body}
    {note && <p className="flx-panel-note" role="status">{note}</p>}
  </aside>;
}
