import {useEffect,useRef,useState} from "react";
import {TextEditor,EditorCommands,type EditorHandle} from "../editor/TextEditor";
import {EditorFrame} from "../editor/EditorChrome";
import type {SurfaceBinding} from "../surface/types";
import "./flow.css";

/**
 * Writing that has not been placed anywhere yet.
 *
 * Writing never waits and never mints: the surface opens, the writing is kept
 * on this device as it is typed, and it survives closing the tab and
 * relaunching. Nothing reaches the ground from here until the human
 * explicitly saves real content — saving places the writing through Central's
 * own Flow operation into its one owner-section home, Control/user/flows,
 * which the footer names beside the ordinary Save. The earlier register
 * picker is gone with the ratified carrier (PROPOSAL-FLOW-DAY-LOGICS-
 * 2026-09-13-2 / #271): one user-section home, no choice to fabricate. An
 * empty draft cannot be placed: no blank placeholder is ever written in the
 * writing's name (owner correction, 2026-09-12 — the blank now/flows/
 * premise was the fault).
 */
export const DRAFT_KEY=(id:string)=>`oi-cradle.unplaced-draft.v1:${id}`;

export function readDraft(id:string):string {
  try{const raw=localStorage.getItem(DRAFT_KEY(id));if(!raw)return "";const parsed:unknown=JSON.parse(raw);
    return parsed&&typeof parsed==="object"&&typeof (parsed as {text?:unknown}).text==="string"?(parsed as {text:string}).text:"";}
  catch{return "";}
}

export function DraftSurface({binding}:{binding:SurfaceBinding}) {
  const editor=useRef<EditorHandle>(null);
  const [text,setText]=useState(()=>readDraft(binding.id));
  const [retained,setRetained]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState<string>();

  useEffect(()=>{setText(readDraft(binding.id));},[binding.id]);
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
    // Empty writing has nothing to place: the ground never receives a blank
    // placeholder from this surface, by the same law the button enforces.
    if(saving||!text.trim())return;
    setSaving(true);setError(undefined);
    window.dispatchEvent(new CustomEvent("oi:place-draft",{detail:{id:binding.id,content:text}}));
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
      <span className="editor-path">Control/user/flows</span>
      <span role="status">{saving?"Saving…":retained?"Unsaved":"Not kept on this device"}</span>
      <button disabled={saving||!text.trim()} onClick={save} title={text.trim()?"Place this writing through Central":"Nothing to place yet — write first"}>Save · ⌘S</button>
    </>}>
    {!retained&&<p role="alert" className="flow-error">This device would not keep the writing. Copy it somewhere you trust before closing this tab.</p>}
    {error&&<p role="alert" className="flow-error">{error}</p>}
    <TextEditor ref={editor} binding={binding} filename="Draft.md" aria-label="Writing not yet saved" value={text} onChange={change} onSave={save} onAttach={attach}/>
  </EditorFrame>;
}
