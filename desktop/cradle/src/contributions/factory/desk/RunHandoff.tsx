/**
 * Handoff — what came back (11-FACTORY §3.5), in FACTORY-AGENCY §7 order:
 * Outcome · What changed · Verification · Observations · Remaining work ·
 * Continue with · Provenance (collapsed). A section with no content is
 * omitted; with nothing returned the tab says "Nothing has come back yet."
 *
 * Recognition controls sit at the top when a returned Return awaits it.
 * Recognise records the person's Recognition through the owner's own
 * developmental mutation and shows the owner's receipt. Request changes and
 * Request evidence appear only where the owner exposes a native operation
 * for them (the action projection's currently-applicable actions) — never as
 * a desktop-invented verb. Agent completion, human recognition and Git
 * integration are shown as three different states.
 */
import {useState} from "react";
import {useKernel} from "../../../kernel/KernelProvider";
import {errorWords, type RunEntry} from "./deskStore";
import {recognise} from "./factoryReads";
import type {RunPageHost} from "./RunPage";
import {revisionWords} from "./RunMap";
import {attemptsFor, frontierNode, pendingRecognitions, refTail, unitChecks, unitOf, type InspectionAttempt} from "./runModel";

export function RunHandoff({entry, host, onRecognised}: {entry: RunEntry; host: RunPageHost; onRecognised: () => void}) {
  const kernel = useKernel();
  const {run, journey, inspection} = entry;
  const [receipt, setReceipt] = useState<{status?: string; contract?: string}>();
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string>();
  const returned = (inspection?.attempts ?? []).filter(attempt => attempt.return?.summary || attempt.status === "returned");
  const journeyReturns = (journey?.returns ?? []).filter(row => !(row.run_refs ?? row.runRefs)?.length || (row.run_refs ?? row.runRefs)!.includes(run.runRef));
  const pending = pendingRecognitions(journey, run.runRef);
  const recognitions = journey?.recognitions ?? [];

  if (!returned.length && !journeyReturns.length) return <div className="frun-empty" data-handoff-empty><p>Nothing has come back yet.</p></div>;

  const primaryAttempt: InspectionAttempt | undefined = returned[returned.length - 1];
  const unitRef = primaryAttempt?.workflowUnitRef;
  const unit = unitOf(inspection, unitRef);
  const agent = refTail(primaryAttempt?.participant?.agentRef);
  const outcome = primaryAttempt?.return?.summary ?? journeyReturns[journeyReturns.length - 1]?.summary;
  const checks = unitChecks(unit?.requiredVerification, attemptsFor(inspection, unitRef));
  const testedAt = checks.find(check => check.revision)?.revision;
  const outstanding = checks.filter(check => check.state !== "passed");
  const next = frontierNode(run);
  const body = primaryAttempt?.body;
  const observations = [refTail(body?.harnessRef), refTail(body?.modelRef)].filter(Boolean).join(" · ");

  const doRecognise = async () => {
    const subject = pending[0];
    const subjectRef = subject?.return_ref ?? subject?.returnRef;
    if (!subjectRef || !entry.card.journeyRef) return;
    setActing(true); setError(undefined);
    try {
      const answer = await recognise(kernel.transport, entry.card.source.statePath, entry.card.journeyRef, subjectRef, [...(subject.evidence_refs ?? [])]);
      setReceipt(answer);
      onRecognised();
    } catch (reason) { setError(errorWords(reason)); }
    finally { setActing(false); }
  };

  return <div className="fhandoff">
    {pending.length > 0 && <div className="fhandoff-recognise" data-recognition="pending">
      <strong>Ready for your recognition</strong>
      <span>{agent ? `${agent[0].toUpperCase()}${agent.slice(1)} returned` : "Returned"}{unit?.developmentalConcern ? ` — ${unit.developmentalConcern}` : ""}</span>
      <span className="fhandoff-recognise-actions">
        <button type="button" className="oi-action oi-action-primary" disabled={acting} onClick={() => void doRecognise()}>{acting ? "Recognising…" : "Recognise"}</button>
      </span>
    </div>}
    {receipt && <p className="fhandoff-receipt" role="status" data-recognition-receipt={receipt.status ?? "recorded"}>Recognised — the owner recorded it{receipt.status ? ` (${receipt.status.replace(/-/g, " ")})` : ""}.</p>}
    {error && <p className="frun-note" role="alert">Recognition was refused: {error}</p>}
    <p className="fhandoff-states" data-handoff-states>
      <span data-state-agent>{returned.length ? "Agent returned" : "Agent completion not recorded"}</span>
      <span data-state-recognition>{recognitions.length && !pending.length ? "Recognised" : pending.length ? "Awaiting your recognition" : "Not recognised"}</span>
      <span data-state-git>Git integration not recorded</span>
    </p>

    {outcome && <section className="fhandoff-section"><h3>Outcome</h3><p data-handoff-outcome>{outcome}</p></section>}

    {checks.length > 0 && <section className="fhandoff-section"><h3>Verification{testedAt ? ` · tested at ${revisionWords(testedAt)}` : ""}</h3>
      <ul className="fmap-checks">{checks.map(check => <li key={check.text} data-check-state={check.state}><span className="fcheck" data-state={check.state} aria-label={check.state}/>{check.text}{check.state === "passed" ? "" : ` — ${check.state}`}</li>)}</ul>
    </section>}

    {observations && <section className="fhandoff-section"><h3>Observations</h3><p>{observations}</p></section>}

    {(outstanding.length > 0 || next) && <section className="fhandoff-section"><h3>Remaining work</h3>
      {outstanding.length > 0 && <p>{outstanding.length} required check{outstanding.length === 1 ? "" : "s"} not yet passed.</p>}
      {next && next.kind !== "destination" && <p>Next: {next.label}</p>}
    </section>}
    {void host}

    <details className="fhandoff-provenance"><summary>Provenance</summary>
      <dl className="fmap-fields">
        {primaryAttempt && <div><dt>Attempt</dt><dd><code>{primaryAttempt.attemptRef}</code></dd></div>}
        {primaryAttempt?.return?.returnRef && <div><dt>Return</dt><dd><code>{primaryAttempt.return.returnRef}</code></dd></div>}
        {journeyReturns.map(row => <div key={row.return_ref ?? row.returnRef}><dt>Journey return</dt><dd><code>{row.return_ref ?? row.returnRef}</code></dd></div>)}
        {recognitions.map(link => <div key={link.recognition_ref ?? link.recognitionRef}><dt>Recognition</dt><dd><code>{link.recognition_ref ?? link.recognitionRef}</code></dd></div>)}
      </dl>
    </details>
  </div>;
}
// "Continue with" (§3.5.6) is omitted: the owner's readable Return carries no
// continuation prompts on this cut, and the desktop does not author them.
