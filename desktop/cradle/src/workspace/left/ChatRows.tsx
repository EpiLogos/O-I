/**
 * A project's conversations as left rows (10-SIDEBARS §3.4): the AIKit
 * SessionSpace reading of the project's attached agent sessions, each a
 * ConversationRow carrying its real session mark.
 *
 * Branch states (§5.2): R8 one quiet "Reading <project>…" line in place of
 * the rows; R9 nothing at all when the project has no conversations; R10
 * "Couldn't load this project." + Retry; R11 the last-known rows stay after
 * a failed refresh and the caller's header can say "as of …".
 */
import {useCallback, useEffect, useRef, useState} from "react";
import {useKernel} from "../../kernel/KernelProvider";
import {kernelOp} from "../../kernel/bridge";
import type {KernelTransportStatus} from "../../kernel/types";
import type {EncounterRow} from "../../encounter/EncounterList";
import {ConversationRow} from "./rows";
import {formatRelativeTime} from "../../shared/relativeTime";

export async function readConversations(transport: KernelTransportStatus, project: string): Promise<EncounterRow[]> {
  const result = await kernelOp(transport, {op: "agency_read", project});
  if (result.error || result.outcome?.result !== "agency_reading") throw new Error(result.error ?? "AIKit SessionSpace reading unavailable");
  const found: EncounterRow[] = [];
  for (const raw of result.outcome.spaces) {
    const space = raw as {definition: {id: string}; label?: string; agent_sessions: Record<string, {purpose?: string}>};
    for (const [ref, attachment] of Object.entries(space.agent_sessions ?? {})) found.push({space: space.definition.id, ref, title: attachment.purpose || space.label || ref, project});
  }
  return found;
}

export type ConversationsState =
  | {kind: "loading"}
  | {kind: "ready"; rows: EncounterRow[]}
  | {kind: "error"; message: string}
  | {kind: "stale"; rows: EncounterRow[]; since: number; message: string};

/** The reading, with its honest states. `refresh` bumps re-read. */
export function useConversations(project: string | undefined, refresh = 0): {state: ConversationsState; retry: () => void} {
  const kernel = useKernel();
  const [state, setState] = useState<ConversationsState>({kind: "loading"});
  const [attempt, setAttempt] = useState(0);
  const last = useRef<{rows: EncounterRow[]; at: number}>();
  useEffect(() => { last.current = undefined; setState({kind: "loading"}); }, [project]);
  useEffect(() => {
    if (project === undefined) return;
    let live = true;
    void readConversations(kernel.transport, project).then(rows => {
      if (!live) return;
      last.current = {rows, at: Date.now()};
      setState({kind: "ready", rows});
    }).catch(error => {
      if (!live) return;
      const message = String(error instanceof Error ? error.message : error);
      setState(last.current ? {kind: "stale", rows: last.current.rows, since: last.current.at, message} : {kind: "error", message});
    });
    return () => { live = false; };
  }, [kernel.transport, project, refresh, attempt]);
  // The rows stay live: re-read when the window regains focus and on a
  // quiet cadence while visible (a new conversation may have been attached
  // elsewhere). A failed re-read keeps the last-known rows (R11).
  useEffect(() => {
    if (project === undefined) return;
    const again = () => { if (document.visibilityState === "visible") setAttempt(value => value + 1); };
    const timer = setInterval(again, 90_000);
    window.addEventListener("focus", again);
    return () => { clearInterval(timer); window.removeEventListener("focus", again); };
  }, [project]);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  return {state, retry};
}

/** The rows themselves, for a branch or a TASKS section. */
export function ChatRows({project, state, retry, activeRef, kind, onOpen, label, staleInHeader}: {project: string; state: ConversationsState; retry: () => void; activeRef?: string; kind?: string; onOpen?: (row: EncounterRow) => void; label?: string; /** The section header already says "as of" (R11). */ staleInHeader?: boolean}) {
  if (state.kind === "loading") return <p className="left-reading" role="status">Reading {label ?? project}…</p>;
  if (state.kind === "error") return <div className="left-error" role="alert" data-error-for={project} title={state.message}><p>Couldn't load this project.</p><button type="button" className="oi-action" onClick={retry}>Retry</button></div>;
  const rows = state.rows;
  return <div className="left-conversations" data-project={project}>
    {state.kind === "stale" && !staleInHeader && <p className="left-stale-line" title={state.message} data-stale-since={state.since}>As of {formatRelativeTime(state.since)} — couldn't refresh. <button type="button" className="left-link" onClick={retry}>Retry</button></p>}
    {rows.map(row => <ConversationRow key={`${row.space}:${row.ref}`} row={row} kind={kind} current={row.ref === activeRef} onOpen={onOpen}/>)}
  </div>;
}
