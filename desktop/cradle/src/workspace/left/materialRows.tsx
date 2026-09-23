/**
 * Material rows for the left bodies (10-SIDEBARS §3.4, A6): the user's
 * flows and a register's remembered notes — each an ordinary row that opens
 * its file in the centre on click, offers Open beside / Pop out on hover,
 * and drags into the composer as a reference (R12).
 *
 * Laws: an absent or empty directory is the ground's own truth about
 * nothing written yet — the section takes zero height (R9); any other
 * refusal says what failed and offers Retry (R10).
 */
import {useCallback, useEffect, useState} from "react";
import {useKernel} from "../../kernel/KernelProvider";
import {kernelOp} from "../../kernel/bridge";
import type {NativeFileEntry} from "../../kernel/types";
import {listFlowInstances, type FlowInstanceRow} from "../../flow/instances";
import {MaterialRow, Section, type SectionState} from "./rows";
import {useLeftHost} from "./host";

/** FLOWS: the dated 0/1 instances in Control/user/flows. */
export function FlowRows({onOpen}: {onOpen: (row: FlowInstanceRow) => Promise<void>}) {
  const kernel = useKernel();
  const host = useLeftHost();
  const [rows, setRows] = useState<FlowInstanceRow[]>();
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    void listFlowInstances(kernel.transport).then(found => { if (live) { setRows(found); setError(undefined); } }).catch(reason => { if (live) setError(String(reason instanceof Error ? reason.message : reason)); });
    return () => { live = false; };
  }, [kernel.transport, attempt]);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  const focused = kernel.snapshot.focus?.subject?.ref;
  const state: SectionState = error ? {kind: "error", message: "Couldn't read your flows.", onRetry: retry}
    : !rows ? {kind: "loading", what: "Reading flows…"}
    : {kind: "ready", rows: rows.length};
  return <Section id="flows" label="Flows" state={state}>
    <div className="project-flows user-flows" data-user-flows="true">
      {(rows ?? []).map(row => <MaterialRow key={row.location.ref} location={row.location} label={row.name.replace(/\.html$/i, "")} title={row.location.path} glyph="list" current={focused === row.location.ref}
        onOpen={() => { void onOpen(row).catch(reason => host.onMessage?.(String(reason))); }}/>)}
    </div>
  </Section>;
}

/** A register's remembered notes as material rows (open in the centre). */
export function RememberedRows({path, label}: {path: string; label: string}) {
  const kernel = useKernel();
  const [entries, setEntries] = useState<NativeFileEntry[]>();
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    void kernelOp(kernel.transport, {op: "files_list", path}).then(result => {
      if (result.error || result.outcome?.result !== "directory_read") throw new Error(result.error ?? "the listing did not serve");
      if (live) { setEntries(result.outcome.directory.entries.filter(entry => entry.kind === "file")); setError(undefined); }
    }).catch(reason => {
      if (!live) return;
      const message = String(reason);
      // The owner refuses a listing of a directory that does not exist:
      // that refusal IS the ground's truth about nothing remembered.
      if (/No such file or directory|not found|does not exist/i.test(message)) { setEntries([]); setError(undefined); }
      else setError(message);
    });
    return () => { live = false; };
  }, [kernel.transport, path, attempt]);
  const focused = kernel.snapshot.focus?.subject?.ref;
  if (error) return <div className="left-error" role="alert" data-error-for={`${label} remembered`}><p>Couldn't read what {label} remembers.</p><button type="button" className="oi-action" onClick={() => setAttempt(value => value + 1)}>Retry</button></div>;
  if (!entries?.length) return null;
  return <div className="left-remembered" data-remembered-list={label}>
    <span className="left-subhead">Remembered</span>
    {entries.map(entry => <MaterialRow key={entry.location.ref} location={entry.location} label={entry.name.replace(/\.(md|txt|json)$/i, "")} glyph="history" current={focused === entry.location.ref}/>)}
  </div>;
}
