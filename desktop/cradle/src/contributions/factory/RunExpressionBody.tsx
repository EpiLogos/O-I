import {useEffect,useRef,useState} from "react";
import type {PresentationBinding} from "../../explore/presentation";
import type {ExpressionDocument} from "../../expression/types";
import type {RunReading,AttemptReading,UnitListReading} from "./run-expression";

export interface RunExpressionBodyProps {
  binding:PresentationBinding;presentationRef:string;onOpenRef?:(ref:string)=>void;hosting:unknown;
  /** Trusted host callback, never read from portable binding.props. */
  onNativeAction?:(actionRef:string)=>Promise<unknown>;
  actionsUnavailable?:string;
}
function NativeReference({value,onChoose}:{value:string;onChoose:(ref:string)=>void}){return <button type="button" className="fb-ref" data-native-ref={value} onClick={()=>onChoose(value)}>{value}</button>;}
const KIND_ORDER=["destination","position","work","decision","candidate","gate","authority","nested_run"];

/** Same native Run; held inspection does not move with the frontier. All
 * traversals use owner refs, not local entity suffixes or display labels. */
export function RunExpressionBody({binding,onOpenRef,onNativeAction,actionsUnavailable}:RunExpressionBodyProps){
  const document=binding.props.document as ExpressionDocument|undefined;
  const run=binding.props.run as RunReading|undefined;
  const attempt=binding.props.attempt as AttemptReading|undefined;
  const units=binding.props.units as UnitListReading|undefined;
  const [selected,setSelected]=useState<string|null>(null);
  const [actionState,setActionState]=useState<{busy:boolean;receipt?:unknown;error?:string}>({busy:false});
  const occasion=useRef(0);
  useEffect(()=>{occasion.current++;setSelected(null);setActionState({busy:false});return ()=>{occasion.current++;};},[run?.runRef,document?.expression_ref]);
  if(!document||!run)return <div className="factory-run-expression" data-run-expression="incomplete">The native Run reading has not returned.</div>;
  const root=Object.values(document.entities).find(entity=>entity.subject?.subject_ref===run.runRef&&entity.subject.presentation_role==="being");
  if(!root)return <div role="alert">This Expression does not bind the selected native Run.</div>;
  const choose=(ref:string)=>setSelected(ref);
  const refs=(values:string[]|undefined)=>(values??[]).map((ref,i)=><NativeReference onChoose={choose} key={`${i}:${ref}`} value={ref}/>);
  const kinds=[...KIND_ORDER,...new Set(Object.values(run.runMap.nodes).map(n=>n.kind).filter(k=>!KIND_ORDER.includes(k)))];
  const selectedRef=selected??run.runRef;
  const occurrences=Object.values(document.entities).filter(entity=>entity.subject?.subject_ref===selectedRef);
  const ids=new Set(occurrences.map(entity=>entity.entity_ref));
  const relations=Object.values(document.relations).filter(r=>ids.has(r.from_entity_ref)||ids.has(r.to_entity_ref));
  const current=attempt?.sourceCurrent;
  const disabled=actionState.busy||!onNativeAction||!!actionsUnavailable||current===false;
  const invoke=async(actionRef:string)=>{
    if(disabled||!onNativeAction)return;
    const begun=occasion.current;setActionState({busy:true});
    try{const receipt=await onNativeAction(actionRef);if(begun===occasion.current)setActionState({busy:false,receipt});}
    catch(error){if(begun===occasion.current)setActionState({busy:false,error:error instanceof Error?error.message:String(error),receipt:(error as {receipt?:unknown})?.receipt});}
  };
  return <article className="factory-run-expression" data-run-expression={run.runRef} data-native-owner={root.subject?.native_owner}>
    <header className="factory-run-expression__header"><h3>{run.destination||run.runRef}</h3><NativeReference onChoose={choose} value={run.runRef}/>
      <p data-frontier={run.lifecycle}>Frontier: {run.lifecycle} · Run revision {run.revision} · topology {run.runMap.topologyRevision}</p>
      <p data-source-current={String(current??"unknown")}>{current===false?"Historical source — continuation or re-admission required before effects.":current===true?"Retained workflow source is current.":"Workflow source currentness is not supplied."}</p>
      {attempt&&<p>Source <NativeReference onChoose={choose} value={attempt.workflowSourceRef}/> · {attempt.workflowSourceRevision} · {attempt.workflowSourceDigest}</p>}
    </header>
    <section className="factory-run-expression__map" data-scene="topology" aria-label="Run map"><h4>Run map</h4>
      {kinds.filter(kind=>Object.values(run.runMap.nodes).some(node=>node.kind===kind)).map(kind=><div key={kind} className="factory-run-expression__lane" data-node-kind={kind}>
        <strong>{kind}</strong>{Object.values(run.runMap.nodes).filter(node=>node.kind===kind).map(node=><div key={node.id} className="factory-run-expression__node" data-node-id={node.id} data-node-state={node.state??"unset"}>
          <button type="button" onClick={()=>choose(`${run.runRef}#${node.id}`)}>{node.label||node.id}</button> · {node.state??"unset"}{node.semanticRef&&<NativeReference onChoose={choose} value={node.semanticRef}/>}</div>)}
      </div>)}
      <div aria-label="Topology edges">{run.runMap.edges.map((edge,i)=><p key={i} data-edge-relation={edge.relation}><NativeReference onChoose={choose} value={`${run.runRef}#${edge.from}`}/> —{edge.relation}→ <NativeReference onChoose={choose} value={`${run.runRef}#${edge.to}`}/></p>)}</div>
    </section>
    <section aria-label="Workflow units"><h4>Workflow source units</h4>{(units?.units??[]).map(unit=><details key={unit.workflowUnitRef}><summary>{unit.key}</summary><NativeReference onChoose={choose} value={unit.workflowUnitRef}/><pre>{JSON.stringify(unit,null,2)}</pre></details>)}</section>
    <section data-scene="executions" aria-label="Attempts"><h4>Attempts</h4>
      {!attempt&&<p data-attempt-availability="missing">No native attempt field is attached. This topology is not execution evidence.</p>}
      {attempt?.attempts.length===0&&<p>No attempt has been recorded.</p>}
      {(attempt?.attempts??[]).map(candidate=><section key={candidate.attemptRef} className="factory-run-expression__attempt" data-attempt-ref={candidate.attemptRef} data-execution-ref={candidate.executionRef??"unbound"}>
        <h5>{candidate.taskRef}</h5><NativeReference onChoose={choose} value={candidate.attemptRef}/><NativeReference onChoose={choose} value={candidate.workflowUnitRef}/>{candidate.executionRef?<NativeReference onChoose={choose} value={candidate.executionRef}/>:<p>Execution not bound.</p>}
        {candidate.disposition?.body&&<p>Session <NativeReference onChoose={choose} value={candidate.disposition.body.agentSessionRef}/> · provider <NativeReference onChoose={choose} value={candidate.disposition.body.providerRef}/></p>}
        {(candidate.verifications??[]).map((v,i)=><p key={i} data-outcome={v.outcome}><NativeReference onChoose={choose} value={v.verificationRef}/> · {v.outcome} · {v.ownerRef} · {v.sourceRevision??"revision unreported"}{refs(v.evidenceRefs)}</p>)}
        {!candidate.verifications?.length&&<p data-outcome="unverified">No verification recorded.</p>}
        {[...(candidate.dispatch?[candidate.dispatch]:[]),...(candidate.observations??[])].map((receipt,i)=><details key={i} data-owner-phase={receipt.phase}><summary>{receipt.phase} · {receipt.ownerRef}</summary><NativeReference onChoose={choose} value={receipt.receiptRef}/><NativeReference onChoose={choose} value={receipt.operationRef}/>{refs(receipt.evidenceRefs)}<pre>{JSON.stringify(receipt,null,2)}</pre></details>)}
        <details><summary>Disposition, tracking and retained attempt evidence</summary><pre>{JSON.stringify(candidate,null,2)}</pre></details>
      </section>)}
      {attempt&&<details><summary>Native legs, barriers and retry state</summary><pre>{JSON.stringify(attempt.legs,null,2)}</pre></details>}
    </section>
    {(attempt?.attempts??[]).filter(a=>a.readableReturn).map(a=><section key={a.attemptRef} data-scene="return" data-return-ref={a.readableReturn!.returnRef} aria-label="Return">
      <h4>Return</h4><NativeReference onChoose={choose} value={a.attemptRef}/><NativeReference onChoose={choose} value={a.readableReturn!.returnRef}/><p>{a.readableReturn!.summary}</p>
      <p>Artifacts {refs(a.readableReturn!.artifactRefs)}</p><p>Evidence {refs(a.readableReturn!.evidenceRefs)}</p>
      {a.readableReturn!.receivingRef?<p data-receiving-ref={a.readableReturn!.receivingRef}>Receiving <NativeReference onChoose={choose} value={a.readableReturn!.receivingRef}/></p>:<p>Native receiving is not recorded.</p>}
    </section>)}
    <section aria-label="Native reference navigation"><h4>Inspect native relationship</h4><code data-selected-native-ref={selectedRef}>{selectedRef}</code>
      <button type="button" disabled={!onOpenRef} onClick={()=>onOpenRef?.(selectedRef)}>Open with native owner</button>{!onOpenRef&&<p>The native reference opener is not connected.</p>}
      {relations.map((relation,i)=><p key={i}><NativeReference onChoose={choose} value={document.entities[relation.from_entity_ref].subject!.subject_ref}/> —{relation.relation.ref}→ <NativeReference onChoose={choose} value={document.entities[relation.to_entity_ref].subject!.subject_ref}/></p>)}
      {occurrences.map(entity=><details key={entity.entity_ref}><summary>{entity.title}</summary><pre>{JSON.stringify(entity.subject,null,2)}</pre></details>)}
    </section>
    <section aria-label="Disclosed actions"><h4>Native Run actions</h4><p>Requests only. Authority and effects remain with the native owner.</p>
      {(run.actions??[]).filter(a=>root.subject?.actions.some(disclosed=>disclosed.action_ref===a.actionRef)).map(action=><p key={action.actionRef}><button type="button" data-action-ref={action.actionRef} disabled={disabled} onClick={()=>void invoke(action.actionRef)}>{action.label}</button> · {action.authorityOwner}{action.requiredCapabilityRef?` · ${action.requiredCapabilityRef}`:""}</p>)}
      {(!onNativeAction||actionsUnavailable)&&<p data-actions-unavailable>{actionsUnavailable??"The trusted native Action handler is not connected."}</p>}
      {actionState.error&&<p role="alert">{actionState.error}</p>}{actionState.receipt!==undefined&&<details open><summary>Native action result — not proof of completed work</summary><pre>{JSON.stringify(actionState.receipt,null,2)}</pre></details>}
    </section>
  </article>;
}
