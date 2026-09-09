import {useEffect,useMemo,useRef,useState} from "react";
import {TextEditor,EditorCommands,type EditorHandle} from "../editor/TextEditor";
import {EditorFrame} from "../editor/EditorChrome";
import {useKernel} from "../kernel/KernelProvider";
import {kernelOp} from "../kernel/bridge";
import type {SurfaceBinding} from "../surface/types";
import "./flow.css";

/**
 * Writing that has not been saved anywhere yet.
 *
 * Writing never waits. The surface opens, the writing is kept on this device
 * as it is typed, and it survives closing the tab and relaunching. The only
 * thing missing is where it belongs, so the footer carries a register picker
 * beside the ordinary Save — the same saving chrome every other editor uses.
 * Saving creates the real Flow in that register's NOW field through Central's
 * own operation; nothing else about the surface changes.
 */
export const DRAFT_KEY=(id:string)=>`oi-cradle.unplaced-draft.v1:${id}`;

export function readDraft(id:string):string {
  try{const raw=localStorage.getItem(DRAFT_KEY(id));if(!raw)return "";const parsed:unknown=JSON.parse(raw);
    return parsed&&typeof parsed==="object"&&typeof (parsed as {text?:unknown}).text==="string"?(parsed as {text:string}).text:"";}
  catch{return "";}
}

export function DraftSurface({binding}:{binding:SurfaceBinding}) {
  const kernel=useKernel();
  const editor=useRef<EditorHandle>(null);
  const [text,setText]=useState(()=>readDraft(binding.id));
  const [retained,setRetained]=useState(true);
  const [project,setProject]=useState(binding.project??"");
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState<string>();

  // Where this writing could be saved. The navigator reading is the fast path;
  // when it holds none but a transport exists the world is read once directly,
  // so a reachable register is never hidden from writing that is waiting.
  const disclosed=useMemo(()=>kernel.snapshot.navigator?.root?.work.projects
    .filter(p=>p.projectcentral.state!=="absent").map(p=>p.name)??[],[kernel.snapshot.navigator]);
  const [read,setRead]=useState<string[]>([]);
  const registers=disclosed.length?disclosed:read;
  useEffect(()=>{
    if(disclosed.length||kernel.transport.kind==="unavailable")return;
    let live=true;
    void kernelOp(kernel.transport,{op:"world_read"}).then(response=>{
      if(!live||response.outcome?.result!=="world_read")return;
      setRead(response.outcome.snapshot.navigator?.root?.work.projects
        .filter(p=>p.projectcentral.state!=="absent").map(p=>p.name)??[]);
    }).catch(()=>{/* Absence is an observation; the writing is kept either way. */});
    return()=>{live=false;};
  },[disclosed.length,kernel.transport]);

  useEffect(()=>{setText(readDraft(binding.id));},[binding.id]);
  useEffect(()=>{if(!project&&registers.length===1)setProject(registers[0]);},[registers,project]);
  useEffect(()=>{
    const done=(event:Event)=>{const detail=(event as CustomEvent<{id:string;error?:string}>).detail;
      if(detail.id!==binding.id)return;setSaving(false);setError(detail.error);};
    window.addEventListener("oi:place-draft-result",done);
    return()=>window.removeEventListener("oi:place-draft-result",done);
  },[binding.id]);

  const change=(value:string)=>{
    setText(value);
    try{localStorage.setItem(DRAFT_KEY(binding.id),JSON.stringify({text:value,at:Date.now()}));setRetained(true);}
    catch{setRetained(false);}
  };
  const save=()=>{
    if(!project||saving)return;
    setSaving(true);setError(undefined);
    window.dispatchEvent(new CustomEvent("oi:place-draft",{detail:{id:binding.id,project,content:text}}));
  };
  const attach=()=>{
    const el=editor.current;if(!el)return;
    const start=el.selectionStart,end=el.selectionEnd;
    const selected=end>start?text.slice(start,end):text;
    if(!selected.trim())return;
    window.dispatchEvent(new CustomEvent("oi:context-candidate",{detail:{bindingId:binding.id,kind:"text",text:selected,start:end>start?start:0,end:end>start?end:text.length,workingCopy:true}}));
  };
  return <EditorFrame className="flow-surface draft-surface" label="Unsaved writing"
    toolbar={<EditorCommands editor={editor} markdown/>}
    footer={<>
      <label className="editor-path draft-register">
        <select aria-label="Where to save" value={project} onChange={e=>setProject(e.target.value)}>
          <option value="">Choose where to save</option>
          {registers.map(name=><option key={name} value={name}>{name}</option>)}
        </select>
      </label>
      <span role="status">{saving?"Saving…":retained?"Unsaved":"Not kept on this device"}</span>
      <button disabled={!project||saving} onClick={save}>Save · ⌘S</button>
    </>}>
    {!retained&&<p role="alert" className="flow-error">This device would not keep the writing. Copy it somewhere you trust before closing this tab.</p>}
    {error&&<p role="alert" className="flow-error">{error}</p>}
    <TextEditor ref={editor} binding={binding} filename="Draft.md" aria-label="Writing not yet saved" value={text} onChange={change} onSave={save} onAttach={attach}/>
  </EditorFrame>;
}
