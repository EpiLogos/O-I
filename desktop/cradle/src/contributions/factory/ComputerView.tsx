import {useEffect,useMemo,useRef,useState} from "react";
import {Terminal} from "@xterm/xterm";
import {FitAddon} from "@xterm/addon-fit";
import {useKernel} from "../../kernel/KernelProvider";
import {kernelOp} from "../../kernel/bridge";
import type {RunEntry} from "./desk/deskStore";
import {errorWords} from "./desk/deskStore";
import {currentAttemptOf} from "./inhabitation/model";
import {refTail} from "./desk/runModel";
import * as client from "./workingSurfaceClient";
import "@xterm/xterm/css/xterm.css";
import "./computer.css";
interface Binding {space:string;binding:string;label:string;surface:string;provider:string}
interface Reading {bindings:Binding[];selected?:Binding;reason?:string;capture?:{capture:{state:string;text?:string;reason?:string;truncated?:boolean}};attachment?:{outcome:string;reason?:string}}
export function ComputerView({entry}:{entry:RunEntry}) {
  const kernel=useKernel();const host=useRef<HTMLDivElement>(null);const terminal=useRef<Terminal>();
  const lease=useRef<client.ClientLease>();const taking=useRef(false);const alive=useRef(true);const generation=useRef(0);
  const [session,setSession]=useState("");const [binding,setBinding]=useState<string>();const [reading,setReading]=useState<Reading>();
  const [error,setError]=useState<string>();const [driving,setDriving]=useState(false);const [busy,setBusy]=useState(false);
  const [attachment,setAttachment]=useState<{outcome:string;reason?:string}>();
  const [recording,setRecording]=useState<string>();
  const project=entry.card.source.project??"";
  const sessions=useMemo(()=>{
    const attempts=entry.inspection?.attempts??[];
    return [...new Set(attempts.map(row=>row.workflowUnitRef))].flatMap(unit=>{
      const selected=currentAttemptOf(attempts.filter(row=>row.workflowUnitRef===unit));
      if(selected.outcome!=="one")return [];
      const row=selected.entries[0];const ref=row.body?.agentSessionRef;
      return ref?[{ref,label:entry.inspection?.units?.find(candidate=>candidate.workflowUnitRef===unit)?.developmentalConcern??refTail(row.participant?.agentRef)??"Current attempt"}]:[];
    }).filter((row,index,rows)=>rows.findIndex(candidate=>candidate.ref===row.ref)===index);
  },[entry.inspection]);
  const selected=sessions.some(row=>row.ref===session)?session:sessions.length===1?sessions[0].ref:"";
  const stop=async()=>{
    const current=lease.current;if(!current)return;
    terminal.current!.options.disableStdin=true;
    try {await client.release(current.client_id);lease.current=undefined;if(alive.current)setDriving(false);}
    catch(reason){if(alive.current)setError(errorWords(reason));}
  };
  useEffect(()=>{
    alive.current=true;
    const term=new Terminal({disableStdin:true,screenReaderMode:true,fontSize:12,scrollback:2000,fontFamily:getComputedStyle(document.body).getPropertyValue("--oi-font-mono").trim(),theme:{background:getComputedStyle(document.body).getPropertyValue("--oi-canvas-ground").trim(),foreground:getComputedStyle(document.body).getPropertyValue("--oi-foreground").trim()}});
    const fit=new FitAddon();term.loadAddon(fit);term.open(host.current!);fit.fit();terminal.current=term;
    const observer=new ResizeObserver(()=>{if(!host.current?.getClientRects().length)return;fit.fit();if(lease.current)void client.resize(lease.current.client_id,{cols:term.cols,rows:term.rows}).catch(reason=>setError(errorWords(reason)));});observer.observe(host.current!);
    let input=Promise.resolve();const data=term.onData(text=>{const current=lease.current;if(current)input=input.then(()=>client.input(current.client_id,text)).catch(reason=>setError(errorWords(reason)));});
    const visibility=()=>{if(document.hidden)void stop();};document.addEventListener("visibilitychange",visibility);
    return()=>{alive.current=false;observer.disconnect();data.dispose();document.removeEventListener("visibilitychange",visibility);void stop().finally(()=>term.dispose());};
  },[]);
  useEffect(()=>{generation.current++;terminal.current?.reset();void stop();return()=>{generation.current++;void stop();};},[selected,binding,project]);
  useEffect(()=>{void kernelOp(kernel.transport,{op:"recording_capability_read"}).then(result=>{if(alive.current&&result.outcome?.result==="recording_capability")setRecording((result.outcome.document as {reason?:string}).reason);});},[kernel.transport]);
  useEffect(()=>{
    let cancelled=false,timer=0,lastText="",checkedBinding="";
    setReading(undefined);setAttachment(undefined);setError(undefined);
    const read=async()=>{
      if(cancelled)return;
      if(lease.current)lastText="";
      if(selected&&!document.hidden&&host.current?.getClientRects().length&&!taking.current&&!lease.current){
        try {
          const result=await kernelOp(kernel.transport,{op:"working_surface_read",project,agent_session:selected,...(binding?{binding}:{})});
          if(result.error||result.outcome?.result!=="working_surface_reading")throw new Error(result.error?errorWords(result.error):"The working surface owner did not answer");
          if(cancelled)return;
          // A native confirmation/attachment may complete while capture is
          // awaiting its owner. Old screen bytes must never replace the live PTY.
          if(taking.current||lease.current){timer=window.setTimeout(read,500);return;}
          const next=result.outcome.document as Reading;setReading(next);setError(undefined);
          const text=next.capture?.capture.text;
          if(typeof text==="string"&&text!==lastText){terminal.current?.reset();terminal.current?.write(text);lastText=text;}
          if(next.selected&&checkedBinding!==next.selected.binding){
            const attached=await kernelOp(kernel.transport,{op:"working_surface_attachment",project,agent_session:selected,binding:next.selected.binding});
            if(!cancelled&&attached.outcome?.result==="working_surface_reading"){setAttachment((attached.outcome.document as Reading).attachment);checkedBinding=next.selected.binding;}
          }
        }catch(reason){if(!cancelled&&!lease.current&&!taking.current){setError(errorWords(reason));setAttachment(undefined);checkedBinding="";}}
      }
      if(!cancelled)timer=window.setTimeout(read,500);
    };void read();return()=>{cancelled=true;clearTimeout(timer);};
  },[selected,binding,project,kernel.transport]);
  const takeOver=async()=>{
    if(!reading?.selected||!terminal.current)return;
    setBusy(true);taking.current=true;setError(undefined);
    try{
      const expected=generation.current;const term=terminal.current;const attached=await client.takeover(project,selected,reading.selected.binding,{cols:term.cols,rows:term.rows});
      if(!alive.current||expected!==generation.current||!host.current?.getClientRects().length){await client.release(attached.client_id);return;}
      lease.current=attached;setDriving(true);term.reset();term.options.disableStdin=false;term.focus();
      const pump=async()=>{
        while(alive.current&&lease.current===attached){
          if(document.hidden||!host.current?.getClientRects().length){await stop();return;}
          const batch=await client.poll(attached.client_id,attached.seq);
          if(!alive.current||lease.current!==attached)return;
          await new Promise<void>(resolve=>term.write(new Uint8Array(batch.bytes),resolve));attached.seq=batch.seq;
          if(batch.eof){await stop();return;}
          await new Promise(resolve=>setTimeout(resolve,40));
        }
      };void pump().catch(async reason=>{if(alive.current)setError(errorWords(reason));await stop();});
    }catch(reason){if(alive.current)setError(errorWords(reason));}
    finally {taking.current=false;if(alive.current)setBusy(false);}
  };
  const reason=reading?.reason??reading?.capture?.capture.reason;
  return <div className="factory-computer">
    <div className="factory-computer-controls">
      <label>Attempt <select aria-label="Computer attempt" value={selected} disabled={driving||busy} onChange={event=>{setSession(event.target.value);setBinding(undefined);}}><option value="">Choose an attempt</option>{sessions.map(row=><option key={row.ref} value={row.ref}>{row.label}</option>)}</select></label>
      {(reading?.bindings.length??0)>1&&<label>Terminal <select aria-label="Bound terminal" disabled={driving||busy} value={binding??""} onChange={event=>setBinding(event.target.value||undefined)}><option value="">Choose a terminal</option>{reading!.bindings.map(row=><option key={row.binding} value={row.binding}>{row.label}</option>)}</select></label>}
      {driving?<button type="button" onClick={()=>void stop()}>Release control</button>:<button type="button" disabled={busy||attachment?.outcome!=="attach"||kernel.transport.kind!=="tauri"} title={attachment?.reason} onClick={()=>void takeOver()}>{busy?"Connecting…":"Take over"}</button>}
      <span role="status">{driving?"You are driving this terminal":"Read-only"}</span>
    </div>
    {!sessions.length&&<p>No current attempt has a bound agent session.</p>}
    {reason&&<p>{reason}</p>}{attachment?.outcome==="not-exposed"&&<p>{attachment.reason}</p>}{error&&<p role="alert">{error}</p>}
    <div ref={host} className="factory-computer-terminal" aria-label="Run terminal"/>
    {reading?.capture?.capture.truncated&&<p>Showing the most recent terminal output.</p>}
    {recording&&<p>{recording}</p>}
  </div>;
}
