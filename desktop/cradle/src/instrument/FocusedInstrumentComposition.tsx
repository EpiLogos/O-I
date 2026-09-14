import {useCallback,useEffect,useRef,useState,type CSSProperties} from "react";
import {createPortal} from "react-dom";
import {activeBindingId} from "../surface/engine";
import type {LayoutState,SurfaceBinding} from "../surface/types";
import {ParticleField} from "../visuals/ParticleExpression";
import {
  FOCUSED_INSTRUMENT_CONTRACT,
  focusedInstrumentSource,
  runFocusedInstrumentCommand,
  subscribeFocusedInstrumentSource,
  type BimbaNavigation,
  type FocusedInstrumentCommand,
  type FocusedInstrumentCommandResult,
  type FocusedInstrumentSnapshot,
  type InstrumentFocus,
  type RetainedExpressionLease,
} from "./source";

const layer:CSSProperties={position:"absolute",inset:0,zIndex:8,overflow:"auto",background:"var(--oi-background, #f5f3ee)",color:"var(--oi-foreground, #111)"};
const panel:CSSProperties={padding:"18px",display:"flex",flexDirection:"column",gap:"14px",minHeight:"100%",boxSizing:"border-box"};
const row:CSSProperties={display:"flex",gap:"6px",alignItems:"center",flexWrap:"wrap"};
const quiet:CSSProperties={fontSize:"12px",lineHeight:1.45,opacity:.72,margin:0};

function usePortalHost(selector:string,enabled:boolean){
  const [host,setHost]=useState<HTMLElement|null>(null);
  useEffect(()=>{
    if(!enabled){setHost(null);return;}
    const locate=()=>setHost(document.querySelector<HTMLElement>(selector));locate();
    const observer=new MutationObserver(locate);observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["data-binding-id"]});
    return()=>observer.disconnect();
  },[selector,enabled]);
  useEffect(()=>{
    if(!host)return;
    const position=host.style.position,overflow=host.style.overflow;
    if(getComputedStyle(host).position==="static")host.style.position="relative";
    host.style.overflow="hidden";
    return()=>{host.style.position=position;host.style.overflow=overflow;};
  },[host]);
  return host;
}

function useSource(ref:string){
  const [snapshot,setSnapshot]=useState<FocusedInstrumentSnapshot|null>(null);
  const [bimba,setBimba]=useState<BimbaNavigation|null>(null);
  const [error,setError]=useState<string|null>(null);
  const sequence=useRef(0);
  const refresh=useCallback(async()=>{
    const source=focusedInstrumentSource(ref),run=++sequence.current;
    if(!source){if(run===sequence.current){setSnapshot(null);setBimba(null);setError(`Focused instrument source ${ref} is not registered.`);}return;}
    try{
      const [next,nextBimba]=await Promise.all([source.read(),source.readBimba()]);
      if(run!==sequence.current)return;
      if(next.schema!==FOCUSED_INSTRUMENT_CONTRACT)throw new Error(`Unsupported focused-instrument contract ${next.schema}`);
      setSnapshot(next);setBimba(nextBimba);setError(null);
    }catch(reason){if(run===sequence.current)setError(reason instanceof Error?reason.message:String(reason));}
  },[ref]);
  useEffect(()=>{void refresh();return subscribeFocusedInstrumentSource(ref,()=>void refresh());},[ref,refresh]);
  return {snapshot,bimba,error};
}

async function issue(ref:string,command:FocusedInstrumentCommand,setResult:(value:FocusedInstrumentCommandResult|null)=>void,setBusy:(value:boolean)=>void){
  setBusy(true);
  try{setResult(await runFocusedInstrumentCommand(ref,command));}
  catch(reason){setResult({standing:"unknown",operation:command.kind,error:reason instanceof Error?reason.message:String(reason)});}
  finally{setBusy(false);}
}

function BimbaNavigator({binding}:{binding:SurfaceBinding}){
  const ref=binding.ref!;const {snapshot,bimba,error}=useSource(ref);const [result,setResult]=useState<FocusedInstrumentCommandResult|null>(null);const [busy,setBusy]=useState(false);
  return <div style={{...layer,zIndex:9}} data-epi-nara-region="bimba"><div style={panel}>
    <header><small style={{letterSpacing:".08em",textTransform:"uppercase",opacity:.55}}>Epi / Nara · Bimba</small><h2 style={{margin:"4px 0 0",fontSize:"18px"}}>Knowledge in the field</h2></header>
    {error?<p role="alert" style={quiet}>{error}</p>:null}
    {bimba?<><p style={quiet}>{bimba.standing}</p><nav aria-label="Bimba selections" style={{display:"grid",gap:"4px"}}>{bimba.items.map((item,index)=>{
      const selected=snapshot?.selection?.selection_ref===item.selection.selection_ref||bimba.selected_ref===item.selection.selection_ref;
      return <button key={`${item.selection.selection_ref}:${index}`} disabled={busy} aria-pressed={selected} onClick={()=>void issue(ref,{kind:"select-bimba",selection:item.selection},setResult,setBusy)} style={{textAlign:"left",padding:"8px 9px",border:"1px solid color-mix(in srgb,currentColor 16%,transparent)",background:selected?"color-mix(in srgb,currentColor 9%,transparent)":"transparent",borderRadius:"5px",cursor:"pointer"}}>
        <strong style={{display:"block",fontSize:"12px"}}>{item.label}</strong><small style={{opacity:.58}}>{item.selection.coordinate_ref} · {item.face??"bimba"}</small>
      </button>;
    })}</nav></>:<p style={quiet}>Waiting for the QL-owned rooted Bimba disclosure.</p>}
    <div style={row}><button disabled={busy||!snapshot?.selection} onClick={()=>void issue(ref,{kind:"set-tracking",tracking:snapshot?.tracking==="pinned"?"follow":"pinned"},setResult,setBusy)}>{snapshot?.tracking==="pinned"?"Follow field":"Pin selection"}</button><button disabled={busy||!snapshot?.selection} onClick={()=>void issue(ref,{kind:"clear-selection"},setResult,setBusy)}>Clear</button></div>
    {snapshot?.selection?<section aria-label="Selected Bimba source"><p style={quiet}><strong>{snapshot.selection.coordinate_ref}</strong><br/>{snapshot.selection.source_ref}<br/>{snapshot.selection.source_revision}<br/>standing: {snapshot.selection_standing??"current"}</p></section>:null}
    {result?.standing!=="applied"?<p role="status" style={quiet}>{result?.standing}{result?.error?`: ${result.error}`:""}</p>:null}
  </div></div>;
}

function mediumLabels(snapshot:FocusedInstrumentSnapshot){
  const binding=snapshot.vak_expression;if(!binding)return [];
  return [binding.literal?"literal":null,binding.glyph_ref?"glyph":null,binding.image_ref?"image":null,binding.musical_performance_ref?"musical":null,binding.enactment_ref?"enacted":null].filter((value):value is string=>!!value);
}

function FocusedInstrumentSurface({binding}:{binding:SurfaceBinding}){
  const ref=binding.ref!;const {snapshot,error}=useSource(ref);const [busy,setBusy]=useState(false);const [result,setResult]=useState<FocusedInstrumentCommandResult|null>(null);const detach=useRef<(()=>void)|undefined>(undefined);const leaseRef=useRef<RetainedExpressionLease|null>(null);
  const attach=useCallback((instance:unknown,host:{canvas:HTMLCanvasElement})=>{
    detach.current?.();detach.current=undefined;
    const native=instance as RetainedExpressionLease;
    let lease:RetainedExpressionLease;
    lease={
      retainedTargetPort:()=>native.retainedTargetPort(),
      checkpointRetainedField:(owner)=>native.checkpointRetainedField(owner),
      restoreRetainedField:(owner,checkpoint)=>{native.restoreRetainedField(owner,checkpoint);return lease;},
      onRecoveryRequired:(listener)=>{const restored=()=>listener();host.canvas.addEventListener("webglcontextrestored",restored);return()=>host.canvas.removeEventListener("webglcontextrestored",restored);},
      inspect:()=>native.inspect(),
      pause:(value=true)=>{native.pause(value);return lease;},
      resume:()=>{native.resume();return lease;},
      renderOnce:()=>{native.renderOnce();return lease;},
    };
    leaseRef.current=lease;
    const source=focusedInstrumentSource(ref);if(!source?.attachExpression)return;
    void Promise.resolve(source.attachExpression(lease)).then(stop=>{detach.current=typeof stop==="function"?stop:undefined;}).catch(reason=>setResult({standing:"unknown",operation:"attach-expression",error:reason instanceof Error?reason.message:String(reason)}));
  },[ref]);
  useEffect(()=>{if(snapshot?.available)leaseRef.current?.resume();else leaseRef.current?.pause(true);},[snapshot?.available]);
  useEffect(()=>()=>{detach.current?.();detach.current=undefined;leaseRef.current=null;},[]);
  const command=(value:FocusedInstrumentCommand)=>void issue(ref,value,setResult,setBusy);
  const active=snapshot?.focus.focus;
  const media=snapshot?mediumLabels(snapshot):[];
  return <div style={layer} data-epi-nara-region="instrument"><ParticleField id={`k9:${binding.id}`} tag="ql.focused-instrument" config={{}} paused={!snapshot?.available} onReady={attach} className="k9-focused-field" style={{position:"absolute",inset:0}}/>
    <div style={{...panel,position:"relative",zIndex:2,pointerEvents:"none"}}>
      <header style={{display:"flex",justifyContent:"space-between",gap:"12px",alignItems:"flex-start"}}><div><small style={{letterSpacing:".1em",textTransform:"uppercase",opacity:.55}}>Focused instrument</small><h1 style={{margin:"3px 0",fontSize:"20px",fontWeight:500}}>{binding.title}</h1><p style={quiet}>{snapshot?.event.subject_ref??ref}</p></div><div style={{...row,pointerEvents:"auto"}}>{(["m1","m2","m3","m4","m5"] as InstrumentFocus[]).map(focus=><button key={focus} disabled={busy} aria-pressed={active===focus} onClick={()=>command({kind:"set-focus",focus})}>{focus.toUpperCase()}</button>)}</div></header>
      <div style={{flex:1,minHeight:"180px"}}/>
      <section style={{display:"grid",gridTemplateColumns:"minmax(180px,1fr) minmax(220px,1.3fr)",gap:"12px",alignItems:"end"}}>
        <div style={{padding:"12px",background:"color-mix(in srgb,var(--oi-background,#f5f3ee) 86%,transparent)",backdropFilter:"blur(8px)",borderRadius:"7px",pointerEvents:"auto"}}><strong>{active?.toUpperCase()??"—"}</strong><p style={quiet}>{snapshot?.focus.standing??"Waiting for the QL owner."}</p>{snapshot?.focus.source_refs?.length?<p style={quiet}>source: {snapshot.focus.source_refs.join(" · ")}</p>:null}<p style={quiet}>field {snapshot?.presented_cursor.field_generation??"—"} / live {snapshot?.live_cursor.field_generation??"—"} · {snapshot?.temporal??"—"}</p></div>
        <div style={{padding:"12px",background:"color-mix(in srgb,var(--oi-background,#f5f3ee) 86%,transparent)",backdropFilter:"blur(8px)",borderRadius:"7px",pointerEvents:"auto",display:"grid",gap:"8px"}}>
          <div style={row}><button disabled={busy} onClick={()=>command(snapshot?.temporal==="frozen"?{kind:"resume-live"}:{kind:"freeze"})}>{snapshot?.temporal==="frozen"?"Resume live":"Freeze view"}</button><button disabled={busy} onClick={()=>command({kind:"assemble-clock"})}>Assemble clock</button><button disabled={busy} onClick={()=>command({kind:"explode-clock",pair:null})}>Explode clock</button><button disabled={busy||!snapshot?.available} onClick={()=>command({kind:"advance",frames:1,muted:false})}>Advance</button></div>
          <p style={quiet}>clock {snapshot?.clock.field_ref??"#3-0"} · centre {snapshot?.clock.centre_ref??"#3-5-5/0"} · {snapshot?.clock.presentation.view??"—"}</p>
          <p style={quiet}>Vāk: {media.length?media.join(" · "):"no source-qualified expression bound"}{snapshot?.vak_performance?` · ${snapshot.vak_performance.mode}${snapshot.vak_performance.has_interruption?" · interrupted":""}${snapshot.vak_performance.has_late_return?" · late Return":""}`:""}</p>
          {snapshot?.selection?<p style={quiet}>Bimba ↔ field: {snapshot.selection.coordinate_ref} · {snapshot.selection_standing}{snapshot.selected_target?` · target ${snapshot.selected_target.identity}`:""}</p>:null}
          {result?<p role="status" style={quiet}>{result.operation}: {result.standing}{result.error?` · ${result.error}`:""}</p>:null}
          {error?<p role="alert" style={quiet}>{error}</p>:null}
        </div>
      </section>
    </div>
  </div>;
}

/**
 * Privileged Epi/Nara composition. It does not replace DesktopShell: it fills
 * the shell's already-owned left and centre hosts while the canonical right
 * AgentLayer remains mounted by Cradle. Leaving the instrument binding removes
 * both portals and reveals the ordinary navigator/workbench unchanged.
 */
export function FocusedInstrumentComposition({layout}:{layout:LayoutState}){
  const active=activeBindingId(layout);const binding=active?layout.surfaces[active]:undefined;const enabled=!!binding&&binding.kind==="instrument"&&!!binding.ref;
  const centre=usePortalHost(enabled?`.surface-body[data-binding-id="${CSS.escape(binding!.id)}"]`:".k9-no-centre",enabled);
  const left=usePortalHost('[data-region="left"] .desktop-side-content',enabled);
  useEffect(()=>{if(!enabled)return;document.body.dataset.epiNaraMode="focused";return()=>{delete document.body.dataset.epiNaraMode;};},[enabled]);
  if(!enabled||!binding)return null;
  return <>{left?createPortal(<BimbaNavigator binding={binding}/>,left):null}{centre?createPortal(<FocusedInstrumentSurface binding={binding}/>,centre):null}</>;
}
