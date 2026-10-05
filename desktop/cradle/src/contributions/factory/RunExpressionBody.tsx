import {useEffect, useState} from "react";
import type {PresentationBinding} from "../../explore/presentation";
import type {ExpressionDocument} from "../../expression/types";
import type {RunReading,AttemptReading} from "./run-expression";
import {currentReturnedAttempts} from "./run-expression";
import {acceptedUnitProgress, runState, RUN_STATE_WORD} from "./desk/runModel";
import {useKernel} from "../../kernel/KernelProvider";
import {PointCloudHost} from "../../expressions/PointCloudHost";
import {ensureExpression} from "./live/liveObjects";
/** The developmental presentation of a Factory Run bound as an Expression
 * (`oi.presentation/factory-run/v1`): the Run's own `oi.expression/v1`
 * document — cast, goal, work objects, topology, attempts and the Return,
 * composed by run-expression.ts from the owner's readings — performed by the
 * Expressions engine (spec §1: the engine-backed field is the Factory
 * presentation). The document is opened in the kernel as bound and hosted by
 * the one Expressions host; the frontier and the Return ride as its caption.
 * Mutation stays request-shaped: every disclosed action names its native
 * authority, and the host never grants it. */

interface RendererProps {binding:PresentationBinding;presentationRef:string;onOpenRef?:(ref:string)=>void;hosting:unknown}

export function RunExpressionBody({binding}:RendererProps){
  const kernel=useKernel();
  const document=binding.props.document as ExpressionDocument|undefined;
  const run=binding.props.run as RunReading|undefined;
  const attempt=binding.props.attempt as AttemptReading|undefined;
  const [state,setState]=useState<"opening"|"ready"|"refused">("opening");
  const [reason,setReason]=useState<string>();
  useEffect(()=>{
    if(!document)return;
    let alive=true;
    ensureExpression(kernel.transport,async()=>document,"desktop:factory-run-presentation")
      .then(()=>{if(alive)setState("ready");})
      .catch(error=>{if(alive){setState("refused");setReason(error instanceof Error?error.message:String(error));}});
    return()=>{alive=false;};
  },[document,kernel.transport]);
  if(!document||!run) return <div className="factory-run-expression" data-run-expression="incomplete">The Run Expression is still composing — the owner readings have not returned.</div>;
  const returned=currentReturnedAttempts(run,attempt);
  const standing=RUN_STATE_WORD[runState(run)];
  const progress=acceptedUnitProgress(run);
  const cast=Object.values(document.entities).filter(entity=>entity.subject?.readings.some(reading=>reading.ref.startsWith("oi.expression-cast/")));
  return (
    <article className="factory-run-expression" data-run-expression={run.runRef} data-expression-ref={document.expression_ref}>
      <header className="factory-run-expression__header">
        <h3>{run.destination||`Run ${run.runRef}`}</h3>
        <p className="factory-run-expression__frontier" data-frontier={run.lifecycle}>{standing}{progress?` · ${progress.accepted} of ${progress.required} units accepted`:""} · {cast.length} in the cast · {attempt?.attempts.length??0} attempt{attempt?.attempts.length===1?"":"s"}{returned.length?` · returned work: ${returned.map(attempt=>attempt.readableReturn!.summary).join(" · ")}`:""}</p>
      </header>
      <div className="factory-run-expression__stage" data-state={state}>
        {state==="ready"&&<PointCloudHost followsOwnRef mode="expressions" deepLink={document.expression_ref}/>}
        {state==="opening"&&<p className="oi-note" role="status">Opening the Run's Expression…</p>}
        {state==="refused"&&<p className="oi-note" role="alert">The Run's Expression could not open: {reason}</p>}
      </div>
      {(run.actions??[]).length>0&&<p className="factory-run-expression__actions-note">Actions: {(run.actions??[]).map(action=>`${action.label} (authority ${action.authorityOwner})`).join(" · ")} — requests only; authority stays with its native owner.</p>}
    </article>
  );
}
