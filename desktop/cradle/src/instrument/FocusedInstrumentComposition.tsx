import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {createPortal} from "react-dom";
import {activeBindingId} from "../surface/engine";
import type {LayoutState,SurfaceBinding} from "../surface/types";
import {useExpressionStage,type StagePresentation} from "../stage/ExpressionStage";
import {FOCUSED_INSTRUMENT_RECIPE} from "../stage/recipes";
import "./instrument.css";
import {exportNaraCues,naraRetainedPresentation,projectNaraExpression} from "./nara-expression-adapter";
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
  return <div className="k9-side" data-epi-nara-region="bimba">
    <div className="k9-bimba">
      <header><p className="k9-kicker">Epi / Nara · Bimba</p><h2 className="k9-title">Knowledge in the field</h2></header>
      {error?<p role="alert" className="k9-alert">{error}</p>:null}
      {bimba?<>
        <p className="k9-quiet">{bimba.standing}</p>
        <nav aria-label="Bimba selections">{bimba.items.map((item,index)=>{
          const selected=snapshot?.selection?.selection_ref===item.selection.selection_ref||bimba.selected_ref===item.selection.selection_ref;
          return <button key={`${item.selection.selection_ref}:${index}`} disabled={busy} aria-pressed={selected} onClick={()=>void issue(ref,{kind:"select-bimba",selection:item.selection},setResult,setBusy)} className="k9-bimba-item">
            <strong>{item.label}</strong>
            <span className="k9-quiet k9-mono">{item.selection.coordinate_ref} · {item.face??"bimba"}</span>
          </button>;
        })}</nav>
      </>:<p className="k9-quiet">Waiting for the QL-owned rooted Bimba disclosure.</p>}
      <div className="k9-row">
        <button disabled={busy||!snapshot?.selection} aria-pressed={snapshot?.tracking==="pinned"} onClick={()=>void issue(ref,{kind:"set-tracking",tracking:snapshot?.tracking==="pinned"?"follow":"pinned"},setResult,setBusy)} className="k9-btn">{snapshot?.tracking==="pinned"?"Follow field":"Pin selection"}</button>
        <button disabled={busy||!snapshot?.selection} onClick={()=>void issue(ref,{kind:"clear-selection"},setResult,setBusy)} className="k9-btn">Clear</button>
      </div>
      {snapshot?.selection?<section aria-label="Selected Bimba source" className="k9-status">
        <p className="k9-quiet"><strong className="k9-mono">{snapshot.selection.coordinate_ref}</strong><br/>{snapshot.selection.source_ref}<br/>{snapshot.selection.source_revision}<br/>standing: {snapshot.selection_standing??"current"}</p>
      </section>:null}
      {result?.standing!=="applied"?<p role="status" className="k9-quiet">{result?.standing}{result?.error?`: ${result.error}`:""}</p>:null}
    </div>
  </div>;
}

function mediumLabels(snapshot:FocusedInstrumentSnapshot){
  const binding=snapshot.vak_expression;if(!binding)return [];
  return [binding.literal?"literal":null,binding.glyph_ref?"glyph":null,binding.image_ref?"image":null,binding.musical_performance_ref?"musical":null,binding.enactment_ref?"enacted":null].filter((value):value is string=>!!value);
}

function FocusedInstrumentSurface({binding}:{binding:SurfaceBinding}){
  const stage=useExpressionStage();
  const ref=binding.ref!;const {snapshot,error}=useSource(ref);const [busy,setBusy]=useState(false);const [result,setResult]=useState<FocusedInstrumentCommandResult|null>(null);const [stageError,setStageError]=useState<string|null>(null);const leaseRef=useRef<RetainedExpressionLease|null>(null);const presentationRef=useRef<StagePresentation|null>(null);
  const presentationId=`k9:${binding.id}`;
  // The stage attach follows source presence: a binding restored from a
  // previous session re-attaches when its owner registers, however late.
  const sourcePresent=!!focusedInstrumentSource(ref);
  useEffect(()=>{
    let detached:(()=>void)|undefined;
    let disposed=false;
    setStageError(null);
    const source=focusedInstrumentSource(ref);
    if(!source){setStageError(`Focused instrument source ${ref} is not registered.`);return;}
    let presentation:StagePresentation|null=null;
    void source.read().then(initial=>{
      if(disposed)return;
      const projected=projectNaraExpression(initial);
      presentation=projected.config&&projected.session
        ?stage.present({id:presentationId,plane:"ambient",recipe:FOCUSED_INSTRUMENT_RECIPE,config:projected.config,sceneRef:`ql:nara:${projected.session.subject_ref}:occasion:${projected.session.personal_reception_generation}`})
        :stage.present({id:presentationId,plane:"ambient",recipe:FOCUSED_INSTRUMENT_RECIPE});
      if(!presentation)throw new Error("The Global Expression Stage is unavailable or expression is disabled.");
      presentationRef.current=presentation;
      const stageLease=stage.retainedLease(presentationId);
      if(!stageLease)throw new Error("The focused stage could not issue its retained-field lease.");
      const lease=stageLease as RetainedExpressionLease;leaseRef.current=lease;
      return Promise.resolve(source.attachExpression?.(lease)).then(stop=>source.read().then(current=>{
        const ready=projectNaraExpression(current);
        if(ready.standing==="current"&&ready.session)lease.updatePresentation(naraRetainedPresentation(ready.session));
        return stop;
      }));
    }).then(stop=>{
      if(disposed){if(typeof stop==="function")stop();return;}
      detached=typeof stop==="function"?stop:undefined;
    }).catch(reason=>{
      presentation?.release();presentation=null;presentationRef.current=null;leaseRef.current=null;
      if(!disposed)setStageError(reason instanceof Error?reason.message:String(reason));
    });
    return()=>{
      disposed=true;
      detached?.();
      detached=undefined;
      leaseRef.current=null;
      presentationRef.current=null;
      presentation?.release();
    };
  },[stage,ref,presentationId,sourcePresent]);
  useEffect(()=>{if(snapshot?.available)leaseRef.current?.resume();else leaseRef.current?.pause(true);},[snapshot?.available]);
  const nara=useMemo(()=>{
    if(!snapshot)return {standing:"unavailable" as const,session:null,config:null,reason:"The QL owner has not supplied a Nara reception."};
    try{return projectNaraExpression(snapshot);}catch(reason){return {standing:"unavailable" as const,session:null,config:null,reason:reason instanceof Error?reason.message:String(reason)};}
  },[snapshot]);
  useEffect(()=>{if(nara.standing==="current"&&nara.session)try{leaseRef.current?.updatePresentation(naraRetainedPresentation(nara.session));}catch(reason){setStageError(reason instanceof Error?reason.message:String(reason));}},[nara]);
  const command=(value:FocusedInstrumentCommand)=>void issue(ref,value,setResult,setBusy);
  const active=snapshot?.focus.focus;
  const media=snapshot?mediumLabels(snapshot):[];
  return <div className="k9-layer" data-epi-nara-region="instrument">
    <div className="k9-identity k9-chip">
      <p className="k9-kicker">Focused instrument</p>
      <h1 className="k9-title">{binding.title}</h1>
      <p className="k9-quiet k9-mono">{snapshot?.event.subject_ref??ref}</p>
    </div>
    <div className="k9-segment k9-chip" role="group" aria-label="Focused determinant">
      {(["m1","m2","m3","m4","m5"] as InstrumentFocus[]).map(focus=>
        <button key={focus} disabled={busy} aria-pressed={active===focus} onClick={()=>command({kind:"set-focus",focus})}>{focus.toUpperCase()}</button>)}
    </div>
    <div className="k9-strip">
      <div className="k9-disclosure k9-chip k9-status">
        <strong>{active?.toUpperCase()??"—"}</strong>
        <p className="k9-quiet">{snapshot?.focus.standing??"Waiting for the QL owner."}</p>
        {snapshot?.focus.source_refs?.length?<p className="k9-quiet k9-mono">source: {snapshot.focus.source_refs.join(" · ")}</p>:null}
        <p className="k9-quiet k9-mono">field {snapshot?.presented_cursor.field_generation??"—"} / live {snapshot?.live_cursor.field_generation??"—"} · {snapshot?.temporal??"—"}</p>
      </div>
      <div className="k9-controls k9-chip">
        <div className="k9-row">
          <button disabled={busy} aria-pressed={snapshot?.temporal==="frozen"} onClick={()=>command(snapshot?.temporal==="frozen"?{kind:"resume-live"}:{kind:"freeze"})} className="k9-btn">{snapshot?.temporal==="frozen"?"Resume live":"Freeze view"}</button>
          <button disabled={busy} onClick={()=>command({kind:"assemble-clock"})} className="k9-btn">Assemble clock</button>
          <button disabled={busy} aria-pressed={snapshot?.clock.presentation.view==="exploded"} onClick={()=>command({kind:"explode-clock",pair:null})} className="k9-btn">Explode clock</button>
          <button disabled={busy||!snapshot?.available} onClick={()=>command({kind:"advance",frames:1,muted:false})} className="k9-btn">Advance</button>
        </div>
        <p className="k9-quiet k9-mono">clock {snapshot?.clock.field_ref??"#3-0"} · centre {snapshot?.clock.centre_ref??"#3-5-5/0"} · {snapshot?.clock.presentation.view??"—"}</p>
        <p className="k9-quiet">Vāk: {media.length?media.join(" · "):"no source-qualified expression bound"}{snapshot?.vak_performance?` · ${snapshot.vak_performance.mode}${snapshot.vak_performance.has_interruption?" · interrupted":""}${snapshot.vak_performance.has_late_return?" · late Return":""}`:""}</p>
        <section className="nara-expression" aria-label="Nara Expression centres" data-standing={nara.standing}>
          <div className="nara-expression-heading"><strong>Nara · seven centres</strong><span>{nara.standing}</span></div>
          {nara.session&&nara.standing==="current"?<>
            <ol>{nara.session.centres.map(centre=><li key={centre.locus_ref} data-centre-ref={centre.locus_ref}><span>{centre.label}</span><span className="k9-mono">{centre.resonance.toFixed(3)}</span></li>)}</ol>
            <p className="k9-quiet k9-mono" data-earth-body-ref={nara.session.earth_body.locus_ref}>EarthBody · {nara.session.earth_body.frame_ref}</p>
            <p className="k9-quiet">Cymatic stations: {nara.session.resonance_stations.availability}{nara.session.resonance_stations.station_refs.length?` · ${nara.session.resonance_stations.station_refs.join(" · ")}`:" · no owner identities disclosed"}</p>
            <button className="k9-btn" onClick={()=>{
              const body=JSON.stringify(exportNaraCues(nara.session!),null,2),url=URL.createObjectURL(new Blob([body],{type:"application/json"})),link=document.createElement("a");link.href=url;link.download="nara-expression-cues.json";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
            }}>Export safe cues</button>
            <span className="sr-only" data-nara-source-refs={nara.session.portable.source_refs.join(" ")} data-nara-action-refs={nara.session.action_refs.join(" ")}/>
          </>:<p className="k9-quiet">{nara.reason}</p>}
        </section>
        {snapshot?.selection?<p className="k9-quiet k9-mono">Bimba ↔ field: {snapshot.selection.coordinate_ref} · {snapshot.selection_standing}{snapshot.selected_target?` · target ${snapshot.selected_target.identity}`:""}</p>:null}
        {result?<p role="status" className="k9-quiet">{result.operation}: {result.standing}{result.error?` · ${result.error}`:""}</p>:null}
        {error?<p role="alert" className="k9-alert">{error}</p>:null}
        {stageError?<p role="alert" className="k9-alert">expression: {stageError}</p>:null}
      </div>
    </div>
  </div>;
}

/**
 * Privileged Epi/Nara composition. It does not replace DesktopShell: it fills
 * the shell's already-owned left and centre hosts while the canonical right
 * AgentLayer remains mounted by Cradle. The live medium is the window's one
 * Global Expression Stage; this composition only overlays controls and leases
 * retained targets to the registered QL source. Leaving the instrument binding
 * removes both portals and releases that stage presentation.
 */
export function FocusedInstrumentComposition({layout}:{layout:LayoutState}){
  const active=activeBindingId(layout);const binding=active?layout.surfaces[active]:undefined;const enabled=!!binding&&binding.kind==="instrument"&&!!binding.ref;
  const centre=usePortalHost(enabled?`.surface-body[data-binding-id="${CSS.escape(binding!.id)}"]`:".k9-no-centre",enabled);
  const left=usePortalHost('[data-region="left"] .desktop-side-content',enabled);
  useEffect(()=>{if(!enabled)return;document.body.dataset.epiNaraMode="focused";return()=>{delete document.body.dataset.epiNaraMode;};},[enabled]);
  if(!enabled||!binding)return null;
  return <>{left?createPortal(<BimbaNavigator binding={binding}/>,left):null}{centre?createPortal(<FocusedInstrumentSurface binding={binding}/>,centre):null}</>;
}
