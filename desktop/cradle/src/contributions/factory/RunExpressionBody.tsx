import type {PresentationBinding} from "../../explore/presentation";
import type {ExpressionDocument} from "../../expression/types";
import type {RunReading,AttemptReading} from "./run-expression";
/** The developmental presentation of a Factory Run bound as an Expression
 * (`oi.presentation/factory-run/v1`). The bound document supplies the SSSF
 * structure; the stage adds presence, never content. Frontier, lanes,
 * barriers, attempts, verifications, evidence and the Return are rendered as
 * the run's actual structure — not as particles, and not as a generic job
 * dashboard. Mutation stays request-shaped: every disclosed action names its
 * native authority, and the host never grants it. */

interface RendererProps {binding:PresentationBinding;presentationRef:string;onOpenRef?:(ref:string)=>void;hosting:unknown}

const KIND_ORDER=["destination","position","work","decision","candidate","gate","authority","nested_run"] as const;

export function RunExpressionBody({binding}:RendererProps){
  const document=binding.props.document as ExpressionDocument|undefined;
  const run=binding.props.run as RunReading|undefined;
  const attempt=binding.props.attempt as AttemptReading|undefined;
  if(!document||!run||!attempt) return <div className="factory-run-expression" data-run-expression="incomplete">The Run Expression is still composing — the owner readings have not returned.</div>;
  const subject=Object.values(document.entities).find(entity=>entity.subject);
  const returned=attempt.attempts.find(candidate=>candidate.readableReturn);
  return (
    <article className="factory-run-expression" data-run-expression={run.runRef} data-native-owner={subject?.subject?.native_owner??"software-factory"}>
      <header className="factory-run-expression__header">
        <h3>{run.destination||`Run ${run.runRef}`}</h3>
        <p className="factory-run-expression__frontier" data-frontier={run.lifecycle}>Frontier: {run.lifecycle} · topology revision {run.runMap.topologyRevision} · attempt reading revision {attempt.revision}</p>
        {subject?.subject && (
          <p className="factory-run-expression__basis">Bound to {subject.subject.native_owner} · source {subject.subject.sources[0]?.ref} · readings {subject.subject.readings.map(reading=>reading.ref).join(" + ")}</p>
        )}
      </header>
      <section className="factory-run-expression__map" data-scene="topology" aria-label="Run map">
        <h4>Run map</h4>
        {KIND_ORDER.filter(kind=>Object.values(run.runMap.nodes).some(node=>node.kind===kind)).map(kind=>(
          <div key={kind} className="factory-run-expression__lane" data-node-kind={kind}>
            <span className="factory-run-expression__lane-label">{kind}</span>
            {Object.values(run.runMap.nodes).filter(node=>node.kind===kind).map(node=>(
              <div key={node.id} className="factory-run-expression__node" data-node-id={node.id} data-node-state={node.state??"unset"}>
                <span>{node.label||node.id}</span>
                {node.semanticRef && <code>{node.semanticRef}</code>}
                {node.state && <span className="factory-run-expression__node-state">{node.state}</span>}
              </div>
            ))}
          </div>
        ))}
        <div className="factory-run-expression__edges" aria-label="Topology edges">
          {run.runMap.edges.map((edge,i)=>(
            <span key={i} className="factory-run-expression__edge" data-edge-relation={edge.relation}>{edge.from} —{edge.relation}→ {edge.to}</span>
          ))}
        </div>
      </section>
      <section className="factory-run-expression__executions" data-scene="executions" aria-label="Attempts">
        <h4>Attempts</h4>
        {attempt.attempts.map(candidate=>(
          <div key={candidate.attemptRef} className="factory-run-expression__attempt" data-attempt-ref={candidate.attemptRef} data-execution-ref={candidate.executionRef??"unbound"}>
            <span className="factory-run-expression__attempt-ref">{candidate.attemptRef}</span>
            <span className="factory-run-expression__attempt-unit">{candidate.workflowUnitRef}</span>
            <ul className="factory-run-expression__verifications">
              {(candidate.verifications??[]).map(verification=>(
                <li key={verification.verificationRef} data-outcome={verification.outcome}>
                  {verification.verificationRef}: {verification.outcome} · {verification.ownerRef} · {verification.sourceRevision}
                  {(verification.evidenceRefs??[]).length>0 && <span> · evidence {verification.evidenceRefs!.join("; ")}</span>}
                </li>
              ))}
              {(candidate.verifications??[]).length===0 && <li data-outcome="unverified">no verification recorded</li>}
            </ul>
          </div>
        ))}
      </section>
      <section className="factory-run-expression__actions" aria-label="Disclosed actions">
        <h4>Actions the run discloses</h4>
        <p className="factory-run-expression__actions-note">Requests only — authority stays with its native owner.</p>
        <ul>
          {(run.actions??[]).map(action=>(
            <li key={action.actionRef} data-action-ref={action.actionRef}>
              {action.label} · authority {action.authorityOwner}{action.requiredCapabilityRef?` · ${action.requiredCapabilityRef}`:""}
            </li>
          ))}
          {(run.actions??[]).length===0 && <li>the run reading declares no actions</li>}
        </ul>
      </section>
      {returned?.readableReturn && (
        <section className="factory-run-expression__return" data-scene="return" aria-label="Return">
          <h4>Return</h4>
          <p>{returned.readableReturn.summary}</p>
          {(returned.readableReturn.evidenceRefs??[]).length>0 && (
            <ul>{(returned.readableReturn.evidenceRefs??[]).map(ref=><li key={ref}><code>{ref}</code></li>)}</ul>
          )}
          {returned.readableReturn.receivingRef && <p data-receiving-ref={returned.readableReturn.receivingRef}>receiving: {returned.readableReturn.receivingRef}</p>}
        </section>
      )}
    </article>
  );
}
