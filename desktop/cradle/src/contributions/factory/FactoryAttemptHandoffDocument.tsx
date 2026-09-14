import {ReturnedDocument,type ReturnedDocumentCallbacks,type ReturnedDocumentReading,type ReturnedEvidence,type ReturnedRuntimeObservation} from "../../returns";
import type {FactoryAttemptTaskReading,FactoryAttemptTaskView,FactoryOwnerTelemetryLink,FactoryVerificationReceipt} from "./attempt-task";

/** Factory's task read remains the source. This adapter projects the public
 * verification receipts and execution correlations it actually discloses;
 * opaque owner records and unresolved material hosts stay opaque. */
export function FactoryAttemptHandoffDocument({reading,callbacks}:{reading:FactoryAttemptTaskReading;callbacks?:ReturnedDocumentCallbacks}) {
  return <section className="factory-attempt-handoff" aria-label="Factory attempt handoff">
    {reading.attempts.length>0?reading.attempts.map(attempt=><ReturnedDocument key={attempt.record.attemptRef} reading={toReturnedDocument(reading,attempt)} callbacks={callbacks}/> ):<ReturnedDocument reading={noAttemptDocument(reading)} callbacks={callbacks}/>}
  </section>;
}

export function toReturnedDocument(reading:FactoryAttemptTaskReading,attempt:FactoryAttemptTaskView):ReturnedDocumentReading {
  const returned=attempt.record.readableReturn;
  const evidence=[
    ...verificationEvidence(attempt.record.verifications),
    ...referenceEvidence("Owner evidence",returned?.evidenceRefs??[]),
    ...referenceEvidence("Failure evidence",attempt.record.failureEvidenceRefs),
    ...referenceEvidence("Regression observation",attempt.regressionObservationRefs),
  ];
  const runtime=[
    ...(attempt.status?[{label:"Execution state",value:attempt.status,standing:"observed" as const}]:[]),
    ...(attempt.record.executionRef?[{label:"Execution",value:attempt.record.executionRef,standing:"observed" as const}]:[]),
    ...telemetryRuntime(attempt),
  ];
  const outstanding=attempt.unresolvedOwnerOperations.map(operation=>({label:`${operation.ownerRef} · ${operation.operationRef}`,ref:operation.receiptRef}));
  return {
    variant:"handoff",
    subject:{title:returned?.summary??"No owner-readable handoff",ref:reading.taskRef},
    outcome:{summary:returned?.summary??"Factory has retained no owner-readable return for this attempt.",standing:[attempt.standing==="historical-attempt"?"Historical attempt":attempt.status,!reading.sourceCurrent?"Saved source basis is no longer current":undefined].filter(Boolean).join(" · ")},
    material:(returned?.artifactRefs??[]).map((ref,index)=>({kind:"artifact" as const,label:`Artifact ${index+1}`,ref})),
    evidence,
    runtime,
    outstanding,
    continuations:uiContinuations(reading,attempt),
    provenance:[
      {label:"Project",value:reading.projectRef},{label:"Run",value:reading.runRef},{label:"Task",value:reading.taskRef},
      {label:"Attempt",value:attempt.record.attemptRef},{label:"Attempt standing",value:attempt.standing},
      {label:"Factory revision",value:String(reading.revision)},{label:"Run revision",value:String(reading.runRevision)},
      {label:"Topology revision",value:String(reading.topologyRevision)},{label:"Source current",value:String(reading.sourceCurrent)},
      {label:"Workflow source",value:reading.workflowSourceRef},{label:"Workflow revision",value:reading.workflowSourceRevision},{label:"Workflow digest",value:reading.workflowSourceDigest},
      {label:"Reserved execution",value:attempt.record.reservedExecutionRef},
      {label:"Receiving",value:attempt.receivingStanding},{label:"Archive",value:attempt.archiveStanding},
      ...(returned?.returnRef?[{label:"Return",value:returned.returnRef}]:[]),
      ...(returned?.receivingRef?[{label:"Receiving ref",value:returned.receivingRef}]:[]),
      ...(returned?.receivingSourceRevision?[{label:"Receiving source revision",value:returned.receivingSourceRevision}]:[]),
      ...returnedArchiveProvenance(returned?.archiveRefs??[]),
    ],
  };
}

function verificationEvidence(receipts:FactoryVerificationReceipt[]):ReturnedEvidence[] {
  if(receipts.length===0)return [{label:"Factory verification",standing:"missing",required:true,detail:"Factory retained no verification records for this attempt."}];
  return receipts.map(receipt=>({
    label:`Verification · ${receipt.ownerRef}`,
    standing:receipt.outcome,
    required:true,
    detail:[`Recorded at ${receipt.sourceRevision}.`,receipt.obligations.length?`Obligations: ${receipt.obligations.join(", ")}.`:undefined].filter(Boolean).join(" "),
    refs:[receipt.verificationRef,...receipt.evidenceRefs],
  }));
}

function telemetryRuntime(attempt:FactoryAttemptTaskView):ReturnedRuntimeObservation[] {
  return attempt.ownerTelemetryCorrelations.flatMap(correlation=>[
    {label:"Telemetry correlation",value:`${correlation.telemetryRef} · ${correlation.executionRef}`,standing:"observed" as const,basis:correlation.correlationRef},
    telemetryLink("Model usage",correlation.modelUsage),
    telemetryLink("Material usage",correlation.materialUsage),
  ]).filter((item):item is ReturnedRuntimeObservation=>Boolean(item));
}

function telemetryLink(label:string,link:FactoryOwnerTelemetryLink):ReturnedRuntimeObservation {
  const observations=link.observations.map(value=>`${value.ref} @ ${value.revision}`).join(", ");
  return {label,value:link.availability==="available"?observations:`${link.availability}: ${link.reason??"no owner reason disclosed"}`,standing:"observed",basis:`${link.owner} owner`};
}

/** These are O:I-authored copyable resumption prompts, composed only from the
 * exact retained Run/task/workflow identity. They are not Factory-authored
 * continuation records and must not be treated as an admission to act. */
function uiContinuations(reading:FactoryAttemptTaskReading,attempt:FactoryAttemptTaskView) {
  return [{label:"UI continuation",prompt:`Resume task ${reading.taskRef} in Run ${reading.runRef} from ${reading.workflowSourceRef} @ ${reading.workflowSourceRevision}; read the current Factory attempt state before taking any action.`},
    ...(attempt.record.readableReturn?[{label:"UI continuation",prompt:`Review retained Return ${attempt.record.readableReturn.returnRef} for task ${reading.taskRef}; confirm its evidence and current source revision before continuing.`}]:[])];
}

function referenceEvidence(label:string,refs:string[]) { return refs.map(ref=>({label,standing:"recorded" as const,refs:[ref]})); }
function returnedArchiveProvenance(refs:string[]) { return refs.map((value,index)=>({label:`Archive ${index+1}`,value})); }

function noAttemptDocument(reading:FactoryAttemptTaskReading):ReturnedDocumentReading {
  return {
    variant:"handoff",
    subject:{title:"No retained attempt record",ref:reading.taskRef},
    outcome:{summary:"Factory retained no attempt record for this task."},
    evidence:[{label:"Factory verification",standing:"missing",required:true,detail:"No Factory attempt exists from which verification can be read."}],
    continuations:[{label:"UI continuation",prompt:`Read the current Factory task state for ${reading.taskRef} in Run ${reading.runRef} before deciding whether new work can be admitted.`}],
    provenance:[
      {label:"Project",value:reading.projectRef},{label:"Run",value:reading.runRef},{label:"Task",value:reading.taskRef},
      {label:"Factory revision",value:String(reading.revision)},{label:"Run revision",value:String(reading.runRevision)},
      {label:"Topology revision",value:String(reading.topologyRevision)},{label:"Source current",value:String(reading.sourceCurrent)},
      {label:"Workflow source",value:reading.workflowSourceRef},{label:"Workflow revision",value:reading.workflowSourceRevision},{label:"Workflow digest",value:reading.workflowSourceDigest},
    ],
  };
}
