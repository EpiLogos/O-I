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
import {useEffect,useRef,useState} from "react";
import {useKernel} from "../../../kernel/KernelProvider";
import {errorWords, type RunEntry} from "./deskStore";
import {readRunReturn,recogniseRunReturn,type NativeRecognitionReceipt,type NativeRunReturnReading} from './runReturnReading';
import type {RunPageHost} from "./RunPage";
import {revisionWords} from "./RunMap";
import {attemptsFor, frontierNode, pendingRecognitions, refTail, unitChecks, unitOf, type InspectionAttempt} from "./runModel";

export function RunHandoff({entry, host, onRecognised}: {entry: RunEntry; host: RunPageHost; onRecognised: () => void}) {
  const kernel = useKernel();
  const {run, journey, inspection} = entry;
  const [receipt, setReceipt] = useState<NativeRecognitionReceipt>();
  const [nativeReturn,setNativeReturn]=useState<NativeRunReturnReading>();
  const [readError,setReadError]=useState<string>();
  const [reading,setReading]=useState(false);
  const region=useRef<HTMLDivElement>(null),mounted=useRef(false),flight=useRef<symbol|null>(null);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string>();
  const returned = (inspection?.attempts ?? []).filter(attempt => attempt.return?.summary || attempt.status === "returned");
  const journeyReturns = (journey?.returns ?? []).filter(row => !(row.run_refs ?? row.runRefs)?.length || (row.run_refs ?? row.runRefs)!.includes(run.runRef));
  const pending = pendingRecognitions(journey, run.runRef);
  const recognitions = journey?.recognitions ?? [];
  const identity=JSON.stringify([kernel.transport,entry.card.source.statePath,entry.card.source.projectRef,run.runRef,run.revision,entry.card.journeyRef,pending]);
  const latest=useRef({identity,host});latest.current={identity,host};
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[]);
  useEffect(()=>{setReceipt(undefined);setNativeReturn(undefined);setReadError(undefined);setError(undefined)},[identity]);
  const capture=()=>{const key=identity,original=host.current;return()=>mounted.current&&latest.current.identity===key&&!!region.current?.getClientRects().length&&(!original||original())&&(!latest.current.host.current||latest.current.host.current())};

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
    const current=capture();if(flight.current||!current())return;
    const subject = pending[0];
    const subjectRef = subject?.return_ref ?? subject?.returnRef;
    if (!subjectRef || !entry.card.journeyRef) return;
    const own=Symbol('native-recognition');flight.current=own;setActing(true); setError(undefined);
    try {
      const answer = await recogniseRunReturn(kernel.transport, {statePath:entry.card.source.statePath,journeyRef:entry.card.journeyRef,subjectRef,basisRefs:[...(subject.evidence_refs ?? [])]},current);
      if(!current())return;
      setReceipt(answer);
      onRecognised();
    } catch (reason) { if(current())setError(errorWords(reason)); }
    finally { if(flight.current===own){flight.current=null;if(mounted.current)setActing(false)} }
  };
  const readReturn=async(attempt:InspectionAttempt)=>{
    const current=capture();if(flight.current||!current())return;
    const own=Symbol('native-return-reading');flight.current=own;setReading(true);setReadError(undefined);
    try{
      const answer=await readRunReturn(kernel.transport,{statePath:entry.card.source.statePath,projectRef:entry.card.source.projectRef,runRef:run.runRef,attemptRef:attempt.attemptRef},current);
      if(current())setNativeReturn(answer);
    }catch(reason){if(current())setReadError(errorWords(reason))}
    finally{if(flight.current===own){flight.current=null;if(mounted.current)setReading(false)}}
  };

  return <div ref={region} className="fhandoff">
    {pending.length > 0 && <div className="fhandoff-recognise" data-recognition="pending">
      <strong>Ready for your recognition</strong>
      <span>{agent ? `${agent[0].toUpperCase()}${agent.slice(1)} returned` : "Returned"}{unit?.developmentalConcern ? ` — ${unit.developmentalConcern}` : ""}</span>
      <span className="fhandoff-recognise-actions">
        <button type="button" className="oi-action oi-action-primary" disabled={acting||reading} onClick={() => void doRecognise()}>{acting ? "Recognising…" : "Recognise"}</button>
      </span>
    </div>}
    {receipt && <p className="fhandoff-receipt" role="status" data-recognition-receipt={receipt.status}>Recognised — the owner acknowledged this exact Return ({receipt.status.replace(/-/g, " ")}).</p>}
    {error && <p className="frun-note" role="alert">Recognition was refused: {error}</p>}
    <p className="fhandoff-states" data-handoff-states>
      <span data-state-agent>{returned.length ? "Agent returned" : "Agent completion not recorded"}</span>
      <span data-state-recognition>{recognitions.length && !pending.length ? "Recognised" : pending.length ? "Awaiting your recognition" : "Not recognised"}</span>
      <span data-state-git>Git integration not recorded</span>
    </p>

    {outcome && <section className="fhandoff-section"><h3>Outcome</h3><p data-handoff-outcome>{outcome}</p></section>}
    {returned.length>0&&<section className="fhandoff-section" aria-label="Native Return material">
      <h3>Returned material</h3>
      <nav>{returned.map(attempt=><button key={attempt.attemptRef} type="button" className="oi-action" disabled={acting||reading}
        aria-pressed={nativeReturn?.attempt.record.attemptRef===attempt.attemptRef} title={attempt.attemptRef} onClick={()=>void readReturn(attempt)}>
        {reading?'Reading…':returned.length===1?'Read native Return':attempt.return?.summary||attempt.attemptRef}
      </button>)}</nav>
      {readError&&<p role="alert">Native Return reading refused: {readError}</p>}
      {nativeReturn&&<>
        <p>{nativeReturn.attempt.standing==='historical-attempt'?'Historical attempt':'Current attempt'} · native revision {nativeReturn.revision}{nativeReturn.sourceCurrent?'':' · workflow source changed'}</p>
        {nativeReturn.attempt.record.readableReturn?<>
          <p>{nativeReturn.attempt.record.readableReturn.summary}</p>
          <dl className="fmap-fields">
            <div><dt>Artifacts</dt><dd>{nativeReturn.attempt.record.readableReturn.artifactRefs.join('\n')||'None recorded'}</dd></div>
            <div><dt>Evidence</dt><dd>{nativeReturn.attempt.record.readableReturn.evidenceRefs.join('\n')||'None recorded'}</dd></div>
            <div><dt>Receiving</dt><dd>{nativeReturn.attempt.record.readableReturn.receivingRef||'Not linked'} · {nativeReturn.attempt.receivingStanding}</dd></div>
            <div><dt>Archive</dt><dd>{nativeReturn.attempt.record.readableReturn.archiveRefs.join('\n')||'Not linked'} · {nativeReturn.attempt.archiveStanding}</dd></div>
            <div><dt>Regression observations</dt><dd>{nativeReturn.attempt.regressionObservationRefs.join('\n')||'None recorded'}</dd></div>
          </dl>
          <p>Open Candidates and evidence in Material. Artifact references alone do not disclose a file or diff address.</p>
        </>:<p>The native owner has not recorded a readable Return for this attempt.</p>}
        {nativeReturn.attempt.unresolvedOwnerOperations.length>0&&<p role="alert">{nativeReturn.attempt.unresolvedOwnerOperations.length} native owner operations remain unresolved.</p>}
        <details><summary>Complete native Return and verification record</summary><pre>{JSON.stringify(nativeReturn,null,2)}</pre></details>
      </>}
    </section>}

    {checks.length > 0 && <section className="fhandoff-section"><h3>Verification{testedAt ? ` · tested at ${revisionWords(testedAt)}` : ""}</h3>
      <ul className="fmap-checks">{checks.map(check => <li key={check.text} data-check-state={check.state}><span className="fcheck" data-state={check.state} aria-label={check.state}/>{check.text}{check.state === "passed" ? "" : ` — ${check.state}`}</li>)}</ul>
    </section>}

    {observations && <section className="fhandoff-section"><h3>Observations</h3><p>{observations}</p></section>}

    {(outstanding.length > 0 || next) && <section className="fhandoff-section"><h3>Remaining work</h3>
      {outstanding.length > 0 && <p>{outstanding.length} required check{outstanding.length === 1 ? "" : "s"} not yet passed.</p>}
      {next && next.kind !== "destination" && <p>Next: {next.label}</p>}
    </section>}

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
