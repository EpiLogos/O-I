import {useEffect,useRef,useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import type {SurfaceBinding} from "../surface/types";
import {encounter,type Draft,type EncounterReading,type EncounterStatus,type PermissionDecision} from "./client";
import {EncounterView} from "./EncounterView";
/** Ephemeral input buffering only. Every accepted edit and message is AIKit-owned. */
export function EncounterSurface({binding,onView,presentation="tab"}:{binding:SurfaceBinding;onView:(view:NonNullable<SurfaceBinding["view"]>)=>void;presentation?:"tab"|"side"|"full"}) {
 const kernel=useKernel();
 const [reading,setReading]=useState<EncounterReading>();const [status,setStatus]=useState<EncounterStatus>();
 const [providers,setProviders]=useState<{id:string;label:string}[]>([]);const [draft,setDraft]=useState("");
 const [error,setError]=useState<string>();const [pending,setPending]=useState(false);
 const canonical=useRef<Draft>({revision:0,text:""});const input=useRef("");const dirty=useRef(false);const saving=useRef(false);const sending=useRef(false);const failed=useRef(false);
 const [before,setBefore]=useState<number>();
 const call=<T,>(request:Parameters<typeof encounter>[2])=>encounter<T>(kernel.transport,binding.project!,request);
 const read=()=>call<EncounterReading>({action:"view",agent_session:binding.ref!,before});
 useEffect(()=>{
  let live=true;let timer:ReturnType<typeof setTimeout>;
  // Honesty law + SELF-OTHER-FIELD-UX "view disposal": a hidden document
  // (backgrounded app, minimized window) pauses network polling rather than
  // spending cycles on a transcript nobody can see. Structural pausing for
  // "collapsed"/"inactive" is the caller's job — it simply does not mount
  // this component while the surface is not the active tab/plane.
  const hidden=()=>document.visibilityState!=="visible";
  const poll=async()=>{
   if(hidden()){if(live)timer=setTimeout(poll,1000);return;}
   try {
    const next=await read();if(!live)return;setReading(next);
    if(!dirty.current&&!saving.current&&!sending.current&&next.draft.revision>=canonical.current.revision){canonical.current=next.draft;input.current=next.draft.text;setDraft(next.draft.text);}
    const current=next.connection ?? await call<EncounterStatus>({action:"status",agent_session:binding.ref!}).catch(()=>undefined);
    if(live)setStatus(current);
   }catch(error){if(live)setError(String(error));}
   if(live)timer=setTimeout(poll,750);
  };
  void call({action:"start"}).then(()=>{if(live){void call<typeof providers>({action:"providers"}).then(rows=>{if(live)setProviders(rows);}).catch(error=>{if(live)setError(String(error));});void poll();}}).catch(error=>{if(live)setError(String(error));});
  const onVisible=()=>{if(live&&!hidden()){clearTimeout(timer);void poll();}};
  document.addEventListener("visibilitychange",onVisible);
  return()=>{live=false;clearTimeout(timer);document.removeEventListener("visibilitychange",onVisible);};
 },[binding.ref,binding.project,before]);
 async function save() {
  if(sending.current||saving.current||failed.current||!dirty.current)return;
  saving.current=true;setPending(true);
  try {
   while(dirty.current) {
    const text=input.current;
    const accepted=await call<Draft>({action:"draft",agent_session:binding.ref!,basis:canonical.current.revision,text});
    canonical.current=accepted;dirty.current=input.current!==text;
   }
  }catch(error){failed.current=true;setError(`${String(error)} Your unsaved typing is still here.`);}
  finally{saving.current=false;setPending(false);}
 }
 const change=(text:string)=>{input.current=text;dirty.current=true;setDraft(text);void save();};
 const connect=async(provider:string)=>{
  setPending(true);setError(undefined);
  try{await call({action:"open",space:binding.encounter!.space,agent_session:binding.ref!,provider});setStatus(await call<EncounterStatus>({action:"status",agent_session:binding.ref!}));}
  catch(error){setError(String(error));}finally{setPending(false);}
 };
 const send=async()=>{
  if(dirty.current||saving.current||sending.current||failed.current)return;
  sending.current=true;const submitted=input.current;setPending(true);setError(undefined);
  try{const response=await call<{draft:Draft}>({action:"prompt",agent_session:binding.ref!,draft_revision:canonical.current.revision});canonical.current=response.draft;if(input.current===submitted){input.current=response.draft.text;setDraft(response.draft.text);}else{dirty.current=true;}setStatus(await call<EncounterStatus>({action:"status",agent_session:binding.ref!}));}
  catch(error){setError(String(error));}finally{sending.current=false;setPending(false);void save();}
 };
 const recover=async()=>{try{const next=await read();canonical.current=next.draft;failed.current=false;dirty.current=input.current!==next.draft.text;setError(undefined);await save();}catch(error){setError(String(error));}};
 const permission=async(request_id:string,decision:PermissionDecision)=>{setPending(true);setError(undefined);try{await call({action:"permission",agent_session:binding.ref!,request_id,decision});const next=await read();setReading(next);setStatus(next.connection);}catch(error){setError(String(error));}finally{setPending(false);}};
 return <><EncounterView presentation={presentation} plane={binding.view?.encounterPlane??"Conversation"} onPlane={encounterPlane=>onView({encounterPlane})} title={binding.title} onPermission={(id,decision)=>void permission(id,decision)} reading={reading} status={status} draft={draft} pending={pending||dirty.current||saving.current||sending.current||failed.current} error={error} providers={providers} onProvider={provider=>void connect(provider)} onDraft={change} onSend={()=>void send()} onCancel={()=>void call({action:"cancel",agent_session:binding.ref!,reason:"User stopped the encounter"}).catch(error=>setError(String(error)))} onEarlier={()=>setBefore(reading?.blocks[0]?.id)} onLatest={()=>setBefore(undefined)}/>{failed.current&&<button onClick={()=>void recover()}>Apply my typing to the current shared draft</button>}</>;
}
