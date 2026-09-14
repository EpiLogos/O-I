import {useState} from "react";
import {kernelOp} from "../kernel/bridge";
import type {ActionDispatch,KernelTransportStatus} from "../kernel/types";
import type {GraphNode} from "./graph";

/** One disclosed spelling's lifecycle through the kernel dispatch seam. The
 * presentation holds no coverage knowledge of its own: buttons stay live for
 * every disclosed spelling, and the adapter's answer settles each row. */
type DispatchRecord =
  | {phase:"dispatching"}
  | {phase:"settled";outcome:ActionDispatch}
  | {phase:"transport_error";detail:string};

/** Owner Actions invoke verbatim through the kernel's typed Action-dispatch
 * seam (KernelOp::InvokeAction, `oi.cradle.action-dispatch/v1`). The ref,
 * target ref and optional input are the owner-disclosed spellings; the
 * kernel adapter is the sole authority on what is invocable — the
 * presentation invents no command translation and assumes no coverage. */
export function OwnerActions({node,transport,project,onDispatched}:{node:Pick<GraphNode,"ref"|"actions">;transport:KernelTransportStatus;project?:string;onDispatched?:()=>void}) {
  const [records,setRecords]=useState<Record<string,DispatchRecord>>({});
  const dispatch=async(action:string)=>{
    setRecords(current=>({...current,[action]:{phase:"dispatching"}}));
    const response=await kernelOp(transport,{op:"invoke_action",project,invocation:{action,target_ref:node.ref}});
    const record:DispatchRecord=response.outcome?.result==="action_dispatched"
      ?{phase:"settled",outcome:response.outcome.dispatch}
      :{phase:"transport_error",detail:response.error??"the kernel returned no dispatch outcome"};
    setRecords(current=>({...current,[action]:record}));
    // The owner's effect (e.g. a familiarity observation for knowledge/open)
    // happened through the owner operation; the surface's own refresh makes
    // it observable. Every invoked state refreshes — the presentation does
    // not special-case spellings.
    if(record.phase==="settled"&&record.outcome.state==="invoked")onDispatched?.();
  };
  return <details className="knowledge-actions"><summary>Actions ({node.actions.length})</summary>
    {node.actions.length>0&&<p>Owner-disclosed Action spellings; each invokes through the kernel dispatch seam verbatim, and the owner answer renders below it.</p>}
    <ul>{node.actions.map((action,index)=>{
      const record=records[action];
      const unsupported=record?.phase==="settled"&&record.outcome.state==="unsupported_action";
      return <li key={`${action}:${index}`}>
        <button
          data-action-ref={action}
          data-subject-ref={node.ref}
          disabled={record?.phase==="dispatching"||unsupported}
          title={unsupported?"The owner exposes no operation for this spelling through the kernel dispatch seam":undefined}
          onClick={()=>void dispatch(action)}>{action}</button>
        {record?.phase==="dispatching"&&<p role="status">Dispatching through the kernel…</p>}
        {record?.phase==="settled"&&<DispatchOutcome outcome={record.outcome}/>}
        {record?.phase==="transport_error"&&<p role="alert">The kernel transport could not serve this dispatch: {record.detail}</p>}
      </li>;})}
    </ul>
  </details>;
}

/** Every dispatch state renders from the adapter response alone — the owner
 * payload unchanged on success, the kernel's reason on unsupported, the
 * owner's own words on refusal, and absence kept distinct from refusal. */
function DispatchOutcome({outcome}:{outcome:ActionDispatch}) {
  switch(outcome.state){
    case "invoked":
      return <div data-dispatch-state="invoked"><p role="status">Invoked · {outcome.owner_operation}</p><pre>{JSON.stringify(outcome.data,null,2)}</pre></div>;
    case "unsupported_action":
      return <p data-dispatch-state="unsupported_action" role="status">{outcome.owner} — {outcome.detail}</p>;
    case "malformed_ref":
      return <p data-dispatch-state="malformed_ref" role="alert">{outcome.detail}</p>;
    case "unknown_owner":
      return <p data-dispatch-state="unknown_owner" role="status">No disclosed owner answers the spelling <code>{outcome.action}</code>.</p>;
    case "owner_refused":
      return <p data-dispatch-state="owner_refused" role="alert">{outcome.owner_operation}: {outcome.message}</p>;
    case "owner_unavailable":
      return <p data-dispatch-state="owner_unavailable" role="status">{outcome.owner_operation} is unavailable — {outcome.detail}</p>;
  }
}
