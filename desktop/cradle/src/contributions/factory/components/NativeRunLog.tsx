import type {ExecutionTraceView,TraceEvent} from "../types";
import {handToPanelInspect} from "../../../agent/planes/panelInspect";

const text=(value:unknown)=>typeof value==="string"?value:JSON.stringify(value,null,2);

/** Read the selected Run's native traces, including each separate attempt.
 * A nearby conversation is never substituted for this execution evidence. */
export function NativeRunLog({traces}:{traces:ExecutionTraceView[]}) {
 if(!traces.length)return <p className="oi-empty">Execution activity will appear here when this Run starts.</p>;
 return <div className="factory-native-log">
  {traces.map((trace,index)=><section key={trace.executionRef} aria-label={`Execution ${index+1}`} data-execution-ref={trace.executionRef}>
   <header><strong>Execution {index+1}</strong> <span>{trace.status}</span></header>
   {trace.request&&<p>{trace.request}</p>}
   {trace.spans.map(span=><section key={span.spanRef} aria-label={span.name}>
    <p><strong>{span.name}</strong> · {span.status}{span.attempt!==undefined?` · attempt ${span.attempt}`:""}{span.modelLabel?` · ${span.modelLabel}`:""}</p>
    {span.error&&<p className="oi-refusal">{span.error}</p>}
    {span.events.map(event=><Event key={event.eventRef} event={event}/>)}
    {!span.events.length&&<p className="oi-note">No events reported for this step.</p>}
   </section>)}
   <details><summary>Execution source</summary><p><code>{trace.executionRef}</code></p>{trace.agentSessionRef&&<p>Session <code>{trace.agentSessionRef}</code></p>}{trace.nativeTrajectory&&<p>{trace.nativeTrajectory.kind} · <code>{trace.nativeTrajectory.ref}</code></p>}</details>
  </section>)}
 </div>;
}
function Event({event}:{event:TraceEvent}) {
 const call=event.toolCall;
 const title=call?.tool??event.name??event.kind.replaceAll("_"," ");
 return <details className="factory-native-log-event" data-event-ref={event.eventRef}>
  <summary><time dateTime={event.timestamp}>{event.timestamp}</time> <strong>{title}</strong>{event.status?` · ${event.status}`:""}{call?.ok===false?" · failed":""}</summary>
  {call?.args!==undefined&&<><h5>Input</h5><pre>{text(call.args)}</pre></>}
  {call?.result!==undefined&&<><h5>Result</h5><pre>{text(call.result)}</pre></>}
  {call?.error&&<p className="oi-refusal">{call.error}</p>}
  {event.payload!==undefined&&<pre>{text(event.payload)}</pre>}
  {call?.durationMs!==undefined&&<p>{call.durationMs} ms</p>}
  <button className="oi-action" onClick={()=>handToPanelInspect({kind:"factory-event",ref:event.eventRef,title,payload:event,source:"Run"})}>Inspect source</button>
 </details>;
}
