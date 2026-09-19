/**
 * The retained attempt-handoff document, ported from the donor cut (PR #292
 * FactoryAttemptHandoffDocument.tsx) into the Desk's design language.
 *
 * Factory's task read remains the source: this projection shows exactly the
 * public fields the owner discloses — verification receipts, execution
 * correlations with their availability, the owner-readable return — and
 * leaves opaque owner records opaque. The UI continuations are O:I-authored
 * copyable resumption prompts composed only from the retained identity; they
 * are not Factory-authored continuation records and never an admission to
 * act. On this kernel cut no new reading can arrive (the owner ops are
 * absent — see attempt-task.ts); a retained document still renders in full.
 */
import {useState} from "react";
import type {FactoryAttemptTaskReading, FactoryAttemptTaskView, FactoryOwnerTelemetryLink} from "./attempt-task";

export function FactoryAttemptHandoffDocument({reading}:{reading:FactoryAttemptTaskReading}) {
  if (reading.attempts.length === 0) return <section className="desk-handoff-empty" aria-label="No retained Factory attempt"><p>No retained Factory attempt for this task.</p></section>;
  return <>{reading.attempts.map(attempt => <AttemptDocument key={attempt.record.attemptRef} reading={reading} attempt={attempt}/>)}</>;
}

function AttemptDocument({reading, attempt}:{reading:FactoryAttemptTaskReading; attempt:FactoryAttemptTaskView}) {
  const returned = attempt.record.readableReturn;
  const [copied, setCopied] = useState<string>();
  const continuations = uiContinuations(reading, attempt);
  const copy = async (prompt: string, label: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) await navigator.clipboard.writeText(prompt);
      setCopied(label);
    } catch { setCopied(undefined); }
  };
  return <article className="desk-handoff-document" data-variant="handoff" aria-label="Handoff document">
    <header className="desk-handoff-document-head">
      <p className="desk-material-kicker">Handoff</p>
      <h4>{returned?.summary ?? "No owner-readable handoff"}</h4>
      <p className="desk-handoff-standing">{[attempt.standing === "historical-attempt" ? "Historical attempt" : attempt.status, !reading.sourceCurrent ? "Saved source basis is no longer current" : undefined].filter(Boolean).join(" · ")}</p>
    </header>

    <section className="desk-handoff-section" aria-label="Verification">
      <h5>Verification</h5>
      {attempt.record.verifications.length === 0
        ? <p className="desk-handoff-missing">Factory retained no verification records for this attempt.</p>
        : <ul className="desk-handoff-evidence">{attempt.record.verifications.map(receipt => <li key={receipt.verificationRef} data-standing={receipt.outcome}>
          <strong>{`Verification · ${receipt.ownerRef}`}</strong><span>{receipt.outcome}</span>
          <p>{[`Recorded at ${receipt.sourceRevision}.`, receipt.obligations.length ? `Obligations: ${receipt.obligations.join(", ")}.` : undefined].filter(Boolean).join(" ")}</p>
          <ReferenceList summary={`Receipt and evidence references (${[receipt.verificationRef, ...receipt.evidenceRefs].length})`} values={[receipt.verificationRef, ...receipt.evidenceRefs]}/>
        </li>)}</ul>}
      {returned?.evidenceRefs.length ? <ReferenceList summary={`Owner evidence (${returned.evidenceRefs.length})`} values={returned.evidenceRefs}/> : null}
      {attempt.record.failureEvidenceRefs.length ? <ReferenceList summary={`Failure evidence (${attempt.record.failureEvidenceRefs.length})`} values={attempt.record.failureEvidenceRefs}/> : null}
      {attempt.regressionObservationRefs.length ? <ReferenceList summary={`Regression observations (${attempt.regressionObservationRefs.length})`} values={attempt.regressionObservationRefs}/> : null}
    </section>

    {(returned?.artifactRefs.length ?? 0) > 0 && <section className="desk-handoff-section" aria-label="Artifacts">
      <h5>Artifacts</h5>
      <ul className="desk-handoff-artifacts">{returned!.artifactRefs.map((ref, index) => <li key={ref}><strong>{`Artifact ${index + 1}`}</strong><code>{ref}</code><small>No native opening target was disclosed for this material.</small></li>)}</ul>
    </section>}

    {(attempt.status || attempt.record.executionRef || attempt.ownerTelemetryCorrelations.length > 0) && <section className="desk-handoff-section" aria-label="Runtime observations">
      <h5>Runtime observations</h5>
      <dl className="desk-handoff-runtime">
        {attempt.status && <div><dt>Execution state</dt><dd>{attempt.status}</dd></div>}
        {attempt.record.executionRef && <div><dt>Execution</dt><dd><code>{attempt.record.executionRef}</code></dd></div>}
        {attempt.ownerTelemetryCorrelations.flatMap(correlation => [
          {label: "Telemetry correlation", value: `${correlation.telemetryRef} · ${correlation.executionRef}`, basis: correlation.correlationRef},
          telemetryLink("Model usage", correlation.modelUsage),
          telemetryLink("Material usage", correlation.materialUsage),
        ]).map(row => <div key={row.label + row.value}><dt>{row.label}</dt><dd>{row.value}<small>{row.basis}</small></dd></div>)}
      </dl>
    </section>}

    {attempt.unresolvedOwnerOperations.length > 0 && <section className="desk-handoff-section" aria-label="Remaining work">
      <h5>Remaining work</h5>
      <ul className="desk-handoff-outstanding">{attempt.unresolvedOwnerOperations.map(operation => <li key={operation.receiptRef}><strong>{`${operation.ownerRef} · ${operation.operationRef}`}</strong><Reference summary="Outstanding reference" value={operation.receiptRef}/></li>)}</ul>
    </section>}

    <section className="desk-handoff-section" aria-label="Continue">
      <h5>Continue</h5>
      <ol className="desk-handoff-continuations">{continuations.map((continuation, index) => <li key={index}>
        <div><small>{continuation.label}</small><code>{continuation.prompt}</code></div>
        <button type="button" onClick={() => void copy(continuation.prompt, `copy-${index}`)}>{copied === `copy-${index}` ? "Copied" : "Copy"}</button>
      </li>)}</ol>
    </section>

    <details className="desk-material-provenance"><summary>Provenance and basis</summary><dl>
      <div><dt>Project</dt><dd><code>{reading.projectRef}</code></dd></div>
      <div><dt>Run</dt><dd><code>{reading.runRef}</code></dd></div>
      <div><dt>Task</dt><dd><code>{reading.taskRef}</code></dd></div>
      <div><dt>Attempt</dt><dd><code>{attempt.record.attemptRef}</code></dd></div>
      <div><dt>Attempt standing</dt><dd>{attempt.standing}</dd></div>
      <div><dt>Factory revision</dt><dd>{reading.revision}</dd></div>
      <div><dt>Run revision</dt><dd>{reading.runRevision}</dd></div>
      <div><dt>Topology revision</dt><dd>{reading.topologyRevision}</dd></div>
      <div><dt>Source current</dt><dd>{String(reading.sourceCurrent)}</dd></div>
      <div><dt>Workflow source</dt><dd><code>{reading.workflowSourceRef}</code></dd></div>
      <div><dt>Workflow revision</dt><dd><code>{reading.workflowSourceRevision}</code></dd></div>
      <div><dt>Workflow digest</dt><dd><code>{reading.workflowSourceDigest}</code></dd></div>
      <div><dt>Reserved execution</dt><dd><code>{attempt.record.reservedExecutionRef}</code></dd></div>
      <div><dt>Receiving</dt><dd>{attempt.receivingStanding}</dd></div>
      <div><dt>Archive</dt><dd>{attempt.archiveStanding}</dd></div>
      {returned?.returnRef && <div><dt>Return</dt><dd><code>{returned.returnRef}</code></dd></div>}
      {returned?.receivingRef && <div><dt>Receiving ref</dt><dd><code>{returned.receivingRef}</code></dd></div>}
      {returned?.receivingSourceRevision && <div><dt>Receiving source revision</dt><dd><code>{returned.receivingSourceRevision}</code></dd></div>}
      {(returned?.archiveRefs ?? []).map((value, index) => <div key={value}><dt>{`Archive ${index + 1}`}</dt><dd><code>{value}</code></dd></div>)}
    </dl></details>
  </article>;
}

function telemetryLink(label: string, link: FactoryOwnerTelemetryLink) {
  const observations = link.observations.map(value => `${value.ref} @ ${value.revision}`).join(", ");
  return {label, value: link.availability === "available" ? observations : `${link.availability}: ${link.reason ?? "no owner reason disclosed"}`, basis: `${link.owner} owner`};
}

/** O:I-authored copyable resumption prompts, composed only from the exact
 * retained Run/task/workflow identity — not Factory-authored continuation
 * records, and never an admission to act. */
function uiContinuations(reading: FactoryAttemptTaskReading, attempt: FactoryAttemptTaskView) {
  return [
    {label: "UI continuation", prompt: `Resume task ${reading.taskRef} in Run ${reading.runRef} from ${reading.workflowSourceRef} @ ${reading.workflowSourceRevision}; read the current Factory attempt state before taking any action.`},
    ...(attempt.record.readableReturn
      ? [{label: "UI continuation", prompt: `Review retained Return ${attempt.record.readableReturn.returnRef} for task ${reading.taskRef}; confirm its evidence and current source revision before continuing.`}]
      : []),
  ];
}

function Reference({summary, value}:{summary:string; value:string}) {
  return <details className="desk-material-reference"><summary>{summary}</summary><code>{value}</code></details>;
}
function ReferenceList({summary, values}:{summary:string; values:string[]}) {
  return <details className="desk-material-reference"><summary>{summary}</summary><ul>{values.map(value => <li key={value}><code>{value}</code></li>)}</ul></details>;
}
