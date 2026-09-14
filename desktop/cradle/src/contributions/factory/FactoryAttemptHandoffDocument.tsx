import type {FactoryAttemptTaskReading, FactoryAttemptTaskView} from "./attempt-task";

/** A human document from Factory's retained attempt-task reading only. */
export function FactoryAttemptHandoffDocument({reading}:{reading:FactoryAttemptTaskReading}) {
  return <article className="factory-attempt-handoff" aria-label="Factory attempt handoff">
    <header><h2>Handoff</h2></header>
    {reading.attempts.map(attempt=><AttemptOutcome key={attempt.record.attemptRef} attempt={attempt}/>) }
    <details>
      <summary>Technical record</summary>
      <dl>
        <dt>Task</dt><dd><code>{reading.taskRef}</code></dd>
        <dt>Run</dt><dd><code>{reading.runRef}</code></dd>
        <dt>Factory revision</dt><dd>{reading.revision}</dd>
        <dt>Source current</dt><dd>{String(reading.sourceCurrent)}</dd>
      </dl>
    </details>
  </article>;
}

function AttemptOutcome({attempt}:{attempt:FactoryAttemptTaskView}) {
  const returned=attempt.record.readableReturn;
  return <section>
    <h3>Outcome</h3>
    {returned ? <>
      <p>{returned.summary}</p>
      <ReferenceList label="Artifacts" refs={returned.artifactRefs}/>
      <ReferenceList label="Evidence" refs={returned.evidenceRefs}/>
    </> : <p>Factory has retained no owner-readable return for this attempt.</p>}
    <details>
      <summary>Native status and references</summary>
      <dl>
        <dt>Execution status</dt><dd>{attempt.status??"not published by Factory"}</dd>
        <dt>Model usage</dt><dd>{attempt.modelUsageStatus}</dd>
        <dt>Material usage</dt><dd>{attempt.materialUsageStatus}</dd>
        <dt>Receiving</dt><dd>{attempt.receivingStanding}</dd>
        <dt>Archive</dt><dd>{attempt.archiveStanding}</dd>
        <dt>Attempt</dt><dd><code>{attempt.record.attemptRef}</code></dd>
        <dt>Standing</dt><dd>{attempt.standing}</dd>
      </dl>
      {returned&&<><p>Return: <code>{returned.returnRef}</code></p><ReferenceList label="Archive references" refs={returned.archiveRefs}/></>}
      <ReferenceList label="Regression observations" refs={attempt.regressionObservationRefs}/>
      {attempt.unresolvedOwnerOperations.length>0&&<section aria-label="Unresolved owner operations">
        <h4>Unresolved owner operations</h4>
        <ul>{attempt.unresolvedOwnerOperations.map(operation=><li key={operation.receiptRef}><code>{operation.ownerRef}</code> · <code>{operation.operationRef}</code> · <code>{operation.receiptRef}</code></li>)}</ul>
      </section>}
    </details>
  </section>;
}

function ReferenceList({label,refs}:{label:string;refs:string[]}) {
  if(refs.length===0)return null;
  return <section><h4>{label}</h4><ul>{refs.map(ref=><li key={ref}><code>{ref}</code></li>)}</ul></section>;
}
