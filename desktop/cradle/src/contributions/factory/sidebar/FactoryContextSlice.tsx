/**
 * Factory's slice of the context sources (11-FACTORY §5, 10-SIDEBARS §3.7,
 * Ruling D5) — offered under the Context canvas while it is empty. The
 * insertion itself is the canvas's own (preserved); this lists what Factory
 * work leans on: the scoped project's Intent (its ProjectCentral/user vision
 * and goals files), the selected run's material (its returned Return), its
 * NOW record, and — for the Position holding the run — the nested
 * prepared-context basis (AIKit's Refocus chain and the joined reading's
 * prepared context with root/child NOW; PreparedBasis.tsx). A file opens
 * through the frame's own file opener, which in Factory lands in this panel's
 * canvas; a NOW record opens its page.
 */
import {useEffect, useState} from "react";
import {useKernel} from "../../../kernel/KernelProvider";
import {kernelOp} from "../../../kernel/bridge";
import type {NativeFileEntry} from "../../../kernel/types";
import {useScope, scopeProject} from "../../../workspace/scope";
import {openObject} from "../../../agent/objects";
import {runEntry, useDeskReading, useSelectedRun} from "../desk/deskStore";
import {firstSentence} from "../desk/runModel";
import {useNowRecord} from "../desk/nowRecord";
import {PreparedBasis} from "./PreparedBasis";
import "../desk/fdesk.css";

const INTENT_FILE = /(vision|goal|intent|telos)/i;

export function FactoryContextSlice() {
  const kernel = useKernel();
  const project = scopeProject(useScope());
  useDeskReading();
  const entry = runEntry(useSelectedRun());
  const [intent, setIntent] = useState<NativeFileEntry[]>();
  useEffect(() => {
    if (!project) { setIntent([]); return; }
    let live = true;
    void kernelOp(kernel.transport, {op: "files_list", path: `Work/${project}/ProjectCentral/user`}).then(result => {
      if (!live) return;
      const entries = result.outcome?.result === "directory_read" ? (result.outcome as unknown as {directory: {entries: NativeFileEntry[]}}).directory.entries : [];
      setIntent(entries.filter(file => file.kind === "file" && (INTENT_FILE.test(file.name) || file.name === `${project}.html`)));
    }).catch(() => { if (live) setIntent([]); });
    return () => { live = false; };
  }, [kernel.transport, project]);
  const nowRef = entry?.inspection?.units?.map(unit => unit.requiredReturn?.address).find(address => address?.startsWith("central:now:"));
  const returned = (entry?.inspection?.attempts ?? []).filter(attempt => attempt.return?.summary);
  const openFile = (file: NativeFileEntry) => window.dispatchEvent(new CustomEvent("oi:techne-open-file", {detail: {location: file.location}}));
  if (!entry && !intent?.length && !nowRef && !returned.length) return null;
  return <div className="fslice" aria-label="Factory context">
    {entry && <PreparedBasis entry={entry} project={project ?? entry.card.source.project}/>}
    {!!intent?.length && <section><h3 className="fagents-head">Intent</h3>{intent.map(file => <button key={file.location.ref} type="button" className="fslice-row" onClick={() => openFile(file)}>{file.name}</button>)}</section>}
    {returned.length > 0 && <section><h3 className="fagents-head">Run material</h3>{returned.map(attempt => <p key={attempt.attemptRef} className="fslice-note">{firstSentence(attempt.return!.summary!)}</p>)}</section>}
    {nowRef && <section><h3 className="fagents-head">NOW</h3><NowRow nowRef={nowRef}/></section>}
  </div>;
}

function NowRow({nowRef}: {nowRef: string}) {
  const now = useNowRecord(nowRef);
  const words = now.reading?.record.purpose ? firstSentence(now.reading.record.purpose) : now.state === "reading" ? "Reading…" : "The run's NOW record";
  return <button type="button" className="fslice-row" onClick={() => openObject({kind: "factory-now", ref: nowRef, title: words})}>{words}</button>;
}
