import {useEffect,useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {kernelOp} from "../kernel/bridge";
import {Loading} from "../shared/Loading";

interface Identity {device:string;inode:string}
export type GroundRequest={action:"status"}|{action:"recognize";path:string}|{action:"bind";request:{expected_previous:string|null;canonical_path:string;identity:Identity}};
interface GroundCheck {path?:unknown;status?:unknown;detail?:unknown}
interface Recognition {
  schema:string;outcome:string;canonical_path?:string;redirected?:boolean;
  identity?:Identity;
  access?:{readable:boolean;searchable:boolean;read_only:boolean;writable?:boolean};
  checks?:GroundCheck[];
  limitations?:unknown;
}

/** One disclosed recognition fact: a human label and its value. The
 * recognition's own fields rendered as components — never a raw dump
 * (owner ruling 2026-09-22: everything renders as a real component). */
function RecognitionFact({label,children}:{label:string;children:React.ReactNode}) {
  return <div className="ground-fact"><dt>{label}</dt><dd>{children}</dd></div>;
}

function word(value:boolean|undefined,yes:string,no:string):string {
  return value===undefined ? "Not disclosed" : value ? yes : no;
}

/** The recognition result, in the words a person reads: what the checks
 * found, how the ground answers, what the owner disclosed as limits. The
 * identity tuple rides its tooltip (it is the bind operation's own
 * material, not a reading aid). */
function RecognitionDetails({reading}:{reading:Recognition}) {
  const checks = Array.isArray(reading.checks) ? reading.checks : [];
  const limitations = Array.isArray(reading.limitations) ? reading.limitations.filter((row):row is string => typeof row==="string") : [];
  const identityText = reading.identity ? `device ${reading.identity.device} · inode ${reading.identity.inode}` : null;
  return <details className="ground-recognition">
    <summary>What was recognised</summary>
    <dl className="ground-facts">
      <RecognitionFact label="Outcome">{reading.outcome}</RecognitionFact>
      <RecognitionFact label="Location">{reading.canonical_path??""}</RecognitionFact>
      <RecognitionFact label="Readable">{word(reading.access?.readable,"yes","no")}</RecognitionFact>
      <RecognitionFact label="Searchable">{word(reading.access?.searchable,"yes","no")}</RecognitionFact>
      <RecognitionFact label="Access">{reading.access?.read_only?"read-only":reading.access?.writable===false?"not writable":"writable"}</RecognitionFact>
      {identityText && <RecognitionFact label="Identity"><span title={identityText}>matches the recognised root</span></RecognitionFact>}
      {checks.length>0 && <RecognitionFact label="Structure">
        <ul className="ground-checks">{checks.map((check,index)=>(
          <li key={index}>{typeof check.path==="string"?check.path:"(unnamed)"} — {typeof check.status==="string"?check.status:"unknown"}{typeof check.detail==="string"&&check.detail?` (${check.detail})`:""}</li>
        ))}</ul>
      </RecognitionFact>}
      {limitations.length>0 && <RecognitionFact label="Limitations">
        <ul className="ground-checks">{limitations.map((limitation,index)=><li key={index}>{limitation}</li>)}</ul>
      </RecognitionFact>}
    </dl>
  </details>;
}

/** Presentation of native recognition. Selection never initializes a root. */
export function GroundChooser() {
 const {transport}=useKernel();
 const [previous,setPrevious]=useState<string|null>();
 const [path,setPath]=useState("");
 const [reading,setReading]=useState<Recognition>();
 const [pending,setPending]=useState(false);
 const [error,setError]=useState<string>();
 const [result,setResult]=useState<string>();
 const call=async(request:GroundRequest)=>{const response=await kernelOp(transport,{op:"ground",request});if(response.error||response.outcome?.result!=="ground_reading")throw new Error(response.error??"Ground operation unavailable");return response.outcome.reading;};
 const status=async()=>{try{const current=await call({action:"status"});if(current.personal_ground!==null&&typeof current.personal_ground!=="string")throw new Error("Suite did not disclose its ground binding");setPrevious(current.personal_ground as string|null);}catch(error){setError(String(error));}};
 useEffect(()=>{void status();},[]);
 const recognize=async(selected:string)=>{setReading(undefined);setResult(undefined);setError(undefined);setPending(true);try{setReading(await call({action:"recognize",path:selected}) as unknown as Recognition);}catch(error){setError(String(error));}finally{setPending(false);}};
 const choose=async()=>{setError(undefined);try{const {invoke}=await import("@tauri-apps/api/core");const selected=await invoke<string|null>("choose_central_folder");if(selected!==null){setPath(selected);await recognize(selected);}}catch(error){setError(String(error));}};
 const bind=async()=>{if(previous===undefined||!reading?.identity||!reading.canonical_path)return;setPending(true);setError(undefined);try{const value=await call({action:"bind",request:{expected_previous:previous,canonical_path:reading.canonical_path,identity:reading.identity}});if(value.outcome!=="bound"&&value.outcome!=="unchanged")throw new Error(`Central binding ${String(value.outcome)}. Review the current selection and recognize it again.`);setResult("Default Central saved. Existing open surfaces retain their current ground; the new default is used on the next launch.");await status();}catch(error){setError(String(error));setReading(undefined);await status();}finally{setPending(false);}};
 const canBind=previous!==undefined&&reading?.outcome==="recognized"&&reading.access?.readable&&reading.access?.searchable&&!!reading.identity&&!!reading.canonical_path;
 return <section className="ground-chooser" aria-label="Central location">
  <h3>Central location</h3>
  <p>{previous===undefined?"Default location unavailable":previous??"No default Central selected"}</p>
  {transport.kind==="tauri"
    ?<button disabled={pending} onClick={()=>void choose()}>Choose Central…</button>
    :<form onSubmit={event=>{event.preventDefault();void recognize(path);}}><label>Existing Central path<input value={path} onChange={event=>{setPath(event.target.value);setReading(undefined);}}/></label><button disabled={pending||!path}>Recognize</button></form>}
  {pending&&<Loading label="Checking Central…"/>}
  {error&&<p role="alert">{error}</p>}
  {reading&&<>
    <p role="status">{reading.outcome}{reading.access?.read_only?" · Read-only":""}</p>
    <p>{reading.canonical_path??path}</p>
    {reading.redirected&&<p>The chosen path is an alias for this canonical location.</p>}
    <RecognitionDetails reading={reading}/>
    <button disabled={pending||!canBind} onClick={()=>void bind()}>Use as default Central</button>
  </>}
  {result&&<p role="status">{result}</p>}
 </section>;
}
