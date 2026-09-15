/**
 * Share / Project — publishing starts from the actual local subject
 * (SHARED-FIELD-DESKTOP §7): one ordinary Expression becomes an
 * audience-filtered Projection through the owner contract
 * (`shared-field/expression-projection.mjs`), attached beside the subject.
 *
 *   local Expression → Share / Project → exact outward preview + omissions
 *   → audience / destination / live-vs-fallback → Projection revision
 *   → Publish to the hosted field → Open in Explore
 *
 * The preview IS the projected WorldPresentation, rendered by the same
 * renderers Explore uses, shown as a client without the live renderer
 * receives it (the explicit fallback) beside a statement of live
 * eligibility. Omissions are named to the publisher and never serialised
 * outward. `Create Projection`, `Publish to the hosted field` and `Open in
 * Explore` are separate acts; nothing reaches the network before the second.
 */
import {useEffect,useMemo,useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {useVisuals} from "../visuals/ParticleExpression";
import {useExpressionStage} from "../stage/ExpressionStage";
import type {ExpressionDocument} from "../expression/types";
import {sharedField,slug,type SharedFieldHostedResult,type SharedFieldStatus} from "../knowledge/shared-field";
import {WorldPresentationView,type WorldPresentation} from "./presentation";
import {navigateExplore} from "./ExploreSurface";
// @ts-ignore -- the language-neutral shared-field contracts are the executable spec.
import {LIVE_RENDERER_REF,hostedExpressionArgs,isProtectedRef,projectExpression} from "../../../../shared-field/expression-projection.mjs";
// @ts-ignore -- the language-neutral shared-field contracts are the executable spec.
import {structuredProjectionReading} from "../../../../shared-field/projection-reading.mjs";
import "./explore.css";

interface Bundle {schema:string;expression_ref:string;expression_revision:number;world_ref:string;field_ref:string;composition:unknown;expression:{live_renderer_ref:string;representations:{kind:string}[]};presentation:WorldPresentation;projection:{projection_ref:string;projection_revision:number;state:string;subject:{kind:string;ref:string};source:{system:string;ref?:string;revision:string};publisher_participant_ref:string;audience:{visibility:string;refs?:string[]}};entry:{ref:string;kind:string;world_ref:string;label:string};field:unknown;participant:unknown;live:{renderer_ref:string;fallback_kinds:string[]};omissions:{readings:number;actions:number;scenes:{scene_ref:string;title:string}[];entities:{entity_ref:string;title:string}[];parameters:{entity_ref:string;parameter:string}[];representations:{kind:string;ref?:string}[];sources:{withheld:{ref:string;availability:string;subject:string}[];protected:{ref:string;subject:string}[];unavailable:{ref:string;availability:string;subject:string}[]};provenance:{ref:string;of:string}[]}}
interface AgentReading {projection_ref:string;projection_revision:number;presentation_ref:string;presentation_revision:number;modules:{renderer:string;props:{expression?:{expression_ref:string;expression_revision:number}}}[]}

export function ShareProjection({document,onClose}:{document:ExpressionDocument;onClose:()=>void}) {
  const {transport}=useKernel();const {snapshot:visuals}=useVisuals();const stage=useExpressionStage();
  const [stamp]=useState(()=>Date.now().toString(36));
  const [sceneRefs,setSceneRefs]=useState<string[]>(()=>document.scenes.map(s=>s.scene_ref));
  const [summary,setSummary]=useState("");
  const [discloseSources,setDiscloseSources]=useState<"available"|"none">("available");
  const [admitted,setAdmitted]=useState<string[]>([]);
  const [visibility,setVisibility]=useState("public");
  const [audienceRefs,setAudienceRefs]=useState("");
  const [publisher,setPublisher]=useState("");
  const [created,setCreated]=useState<Bundle>();
  const [error,setError]=useState<string>();
  const [hostedStatus,setHostedStatus]=useState<SharedFieldStatus>();
  const [hosted,setHosted]=useState<SharedFieldHostedResult>();
  const [busy,setBusy]=useState(false);
  const protectedCandidates=useMemo(()=>{const refs=new Set<string>();for(const entity of Object.values(document.entities))for(const source of entity.subject?.sources??[])if(source.availability==="available"&&isProtectedRef(source.ref))refs.add(source.ref);for(const reading of document.provenance)if(isProtectedRef(reading.ref))refs.add(reading.ref);for(const relation of Object.values(document.relations))for(const reading of relation.provenance)if(isProtectedRef(reading.ref))refs.add(reading.ref);return [...refs];},[document]);
  const refs=audienceRefs.split(/[\s,]+/).filter(Boolean);
  const preview=useMemo<{bundle?:Bundle;error?:string}>(()=>{
    try{
      const bundle=(projectExpression({document,selection:{scene_refs:sceneRefs,...(summary.trim()?{summary:summary.trim()}:{}),disclose_sources:discloseSources,include_source_refs:admitted},publisher:{identity_ref:publisher.trim()||"human:unnamed"},audience:{visibility,...(refs.length?{refs}:{})},projection_ref:`projection:desktop:${slug(document.expression_ref)}:${stamp}`,presentation_ref:`presentation:desktop:${slug(document.expression_ref)}:${stamp}`,live_renderer_ref:LIVE_RENDERER_REF}) as unknown) as Bundle;
      return {bundle};
    }catch(cause){return {error:String(cause instanceof Error?cause.message:cause)};}
  },[document,sceneRefs,summary,discloseSources,admitted,publisher,visibility,audienceRefs,stamp]);
  useEffect(()=>{setCreated(undefined);setHosted(undefined);},[document.expression_ref,document.revision,sceneRefs,summary,discloseSources,admitted,publisher,visibility,audienceRefs]);
  useEffect(()=>{
    if(!created||hostedStatus)return;
    let active=true;
    void sharedField<SharedFieldStatus>(transport,{kind:"status"}).then(s=>{if(active)setHostedStatus(s);}).catch(err=>{if(active)setHostedStatus({state:"unavailable",owner_operation:"shared-field.projection",detail:String(err)});});
    return()=>{active=false;};
  },[created,hostedStatus,transport]);
  const bundle=preview.bundle;
  const liveHere=visuals.enabled&&!stage.error;
  const create=()=>{
    setError(undefined);
    if(!publisher.trim()){setError("Name the publishing identity — publication carries its attribution.");return;}
    if(!bundle){setError(preview.error??"The preview could not be composed");return;}
    setCreated(bundle);
  };
  const publishHosted=async()=>{
    if(!created)return;setBusy(true);setError(undefined);
    try{setHosted(await sharedField<SharedFieldHostedResult>(transport,{kind:"publish",args:hostedExpressionArgs(created)}));}
    catch(err){setError(String(err instanceof Error?err.message:err));}
    finally{setBusy(false);}
  };
  const openInExplore=()=>{if(!created)return;navigateExplore({ref:created.entry.ref});window.dispatchEvent(new CustomEvent("oi:open-explore",{detail:{ref:created.entry.ref,title:created.entry.label}}));};
  const bound=hostedStatus&&"bound" in hostedStatus&&hostedStatus.bound?hostedStatus:undefined;
  const absentReason=hostedStatus?("bound" in hostedStatus?(hostedStatus.bound?"":hostedStatus.reason):hostedStatus.detail):"";
  const agentReading=useMemo<AgentReading|undefined>(()=>{if(!created)return undefined;try{return structuredProjectionReading(created.projection) as AgentReading;}catch{return undefined;}},[created]);
  const agentSummary=agentReading?{projection_ref:agentReading.projection_ref,projection_revision:agentReading.projection_revision,presentation_ref:agentReading.presentation_ref,presentation_revision:agentReading.presentation_revision,expression:agentReading.modules.find(m=>m.renderer==="oi.presentation/expression/v1")?.props.expression}:undefined;
  const o=bundle?.omissions;
  return <section className="share-projection" aria-label="Share / Project" data-expression-ref={document.expression_ref} data-expression-revision={document.revision} data-preview-projection-ref={bundle?.projection.projection_ref} data-created={Boolean(created)} data-hosted={Boolean(hosted)}>
    <header className="share-head"><div><small>Share / Project</small><strong>{document.title}</strong><span>{document.expression_ref} · revision {document.revision}</span></div><button type="button" aria-label="Close share" onClick={onClose}>×</button></header>
    {preview.error&&<p role="alert">{preview.error}</p>}
    <div className="share-columns">
      <div className="share-preview-column">
        <h3>Outward preview <small>exactly what another world receives</small></h3>
        {bundle&&<div className="share-preview" data-preview-payload={JSON.stringify(bundle.projection)}><WorldPresentationView presentation={bundle.presentation} hosting="preview"/></div>}
        {bundle&&<dl className="share-live" data-live-renderer={bundle.live.renderer_ref} data-fallback-kinds={bundle.live.fallback_kinds.join(",")}><dt>Live</dt><dd>eligible for <code>{bundle.live.renderer_ref}</code>{liveHere?" — this desktop admits it and would render live":" — this desktop's stage is off; it would render the fallback"}</dd><dt>Fallback</dt><dd>{bundle.live.fallback_kinds.join(", ")||"none"} · a client without the live renderer receives the frozen reading of the same revision</dd></dl>}
      </div>
      <div className="share-controls-column">
        <section className="share-omissions" aria-label="Omissions" data-omitted-readings={o?.readings} data-omitted-actions={o?.actions}>
          <h3>Withheld from the outward representation</h3>
          {o&&<ul>
            <li data-omission="readings">{o.readings} private reading ref{o.readings===1?"":"s"} (never published)</li>
            <li data-omission="actions">{o.actions} Action disclosure{o.actions===1?"":"s"} (authority is per caller, never published)</li>
            {o.scenes.map(s=><li key={s.scene_ref} data-omission="scene">scene not selected: {s.title}</li>)}
            {o.entities.map(e=><li key={e.entity_ref} data-omission="entity">entity only in an unselected scene: {e.title}</li>)}
            {o.parameters.map(p=><li key={`${p.entity_ref}:${p.parameter}`} data-omission="parameter">parameter outside the material vocabulary: {p.parameter}</li>)}
            {o.representations.map((r,i)=><li key={i} data-omission="representation">renderer-local representation: {r.kind}{r.ref?` · ${r.ref}`:""}</li>)}
            {o.sources.withheld.map((s,i)=><li key={`w${i}`} data-omission="source-withheld">source {s.availability}: <code>{s.ref}</code></li>)}
            {o.sources.unavailable.map((s,i)=><li key={`u${i}`} data-omission="source-unavailable">source {s.availability}: <code>{s.ref}</code></li>)}
            {o.sources.protected.map((s,i)=><li key={`p${i}`} data-omission="source-protected">protected ground, not admitted: <code>{s.ref}</code></li>)}
            {o.provenance.map((p,i)=><li key={`v${i}`} data-omission="provenance">protected provenance ref: <code>{p.ref}</code></li>)}
          </ul>}
        </section>
        <section className="share-selection" aria-label="Selection">
          <h3>Selection</h3>
          <div className="share-scenes">{document.scenes.map(scene=><label key={scene.scene_ref}><input type="checkbox" checked={sceneRefs.includes(scene.scene_ref)} onChange={e=>setSceneRefs(current=>e.target.checked?[...current,scene.scene_ref].filter((r,i,a)=>a.indexOf(r)===i):current.filter(r=>r!==scene.scene_ref))}/>{scene.title}</label>)}</div>
          <label>Source refs<select aria-label="Disclose source refs" value={discloseSources} onChange={e=>setDiscloseSources(e.target.value as "available"|"none")}><option value="available">available, non-protected</option><option value="none">none</option></select></label>
          {protectedCandidates.length>0&&<div className="share-admit"><span>Admit protected refs explicitly</span>{protectedCandidates.map(ref=><label key={ref}><input type="checkbox" checked={admitted.includes(ref)} onChange={e=>setAdmitted(current=>e.target.checked?[...current,ref]:current.filter(r=>r!==ref))}/><code>{ref}</code></label>)}</div>}
          <label>Summary<input aria-label="Projection summary" value={summary} onChange={e=>setSummary(e.target.value)} placeholder="one line another world reads first" autoComplete="off" spellCheck={false}/></label>
        </section>
        <section className="share-audience" aria-label="Audience">
          <h3>Audience</h3>
          <label>Visibility<select aria-label="Projection visibility" value={visibility} onChange={e=>setVisibility(e.target.value)}>{["public","unlisted","restricted","private"].map(v=><option key={v} value={v}>{v}</option>)}</select></label>
          <label>Audience participants<input aria-label="Audience participants" value={audienceRefs} onChange={e=>setAudienceRefs(e.target.value)} placeholder="comma-separated participant refs (restricted / private)" autoComplete="off" spellCheck={false}/></label>
          <label>Publish as<input aria-label="Publisher identity" value={publisher} onChange={e=>setPublisher(e.target.value)} placeholder="your identity ref (e.g. human:…) — the field-scoped participant is derived" autoComplete="off" spellCheck={false}/></label>
          {bundle&&<p className="share-destination">World <code>{bundle.world_ref}</code> · field <code>{bundle.field_ref}</code> · projection <code>{bundle.projection.projection_ref}</code></p>}
        </section>
        <div className="share-actions">
          <button type="button" className="share-create" disabled={!bundle||!!created} onClick={create}>Create Projection</button>
          {created&&<div className="share-created" data-projection-ref={created.projection.projection_ref} data-projection-revision={created.projection.projection_revision} data-projection-state={created.projection.state} data-presentation-ref={created.presentation.presentation_ref} data-presentation-revision={created.presentation.revision} data-source-revision={created.projection.source.revision} data-projection={JSON.stringify(created.projection)}>
            <p role="status">Projection <code>{created.projection.projection_ref}</code> · revision {created.projection.projection_revision} · {created.projection.state} — subject <code>{created.projection.subject.ref}</code> at source revision {created.projection.source.revision}; presentation <code>{created.presentation.presentation_ref}</code> revision {created.presentation.revision}; audience {created.projection.audience.visibility}{created.projection.audience.refs?`: ${created.projection.audience.refs.join(", ")}`:""}; published by {created.projection.publisher_participant_ref} (identity {publisher.trim()}). The Expression itself is unchanged at revision {created.expression_revision}.</p>
            {agentSummary&&<details className="share-agent-reading"><summary>Structured reading (what an Agent receives)</summary><pre data-agent-reading={JSON.stringify(agentSummary)}>{JSON.stringify(agentSummary,null,2)}</pre></details>}
            {!hosted&&bound&&<div className="share-host" data-hosted-target={`${bound.target.uri}/${bound.target.database}`}><span>Hosting target <code>{bound.target.name}</code> ({bound.target.uri}/{bound.target.database}) is bound. Publishing places this Projection, its field, its publisher and one Explore entry there — visible to the {created.projection.audience.visibility} audience.</span><button type="button" className="share-host-send" disabled={busy} onClick={()=>void publishHosted()}>{busy?"Publishing to the hosted field…":"Publish to the hosted field"}</button></div>}
            {!hosted&&hostedStatus&&!bound&&<p className="share-host-absent" role="status" data-hosted-bound="false">No hosting target is bound for this desktop — {absentReason}. The Projection remains local beside this Expression; nothing was sent.</p>}
            {hosted&&<div className="share-hosted" data-hosted-result={JSON.stringify(hosted)} data-hosted-projection-ref={hosted.hosted_projection_row.projectionRef} data-hosted-entry-ref={hosted.entries[0]??""}><p role="status">Hosted in <code>{hosted.target.name}</code>: projection row <code>{hosted.hosted_projection_row.projectionKey}</code> · revision {hosted.hosted_projection_row.projectionRevision} · source revision {hosted.hosted_projection_row.sourceRevision} · {hosted.hosted_projection_row.state}; entry <code>{hosted.entries[0]}</code>; transport identity <code>{hosted.transport_identity}</code> — the client's connection identity, not a human participant.</p></div>}
            <button type="button" className="share-open-explore" disabled={!hosted} title={hosted?"Encounter the hosted representation in Explore":"Open in Explore needs the hosted field; publish first"} onClick={openInExplore}>Open in Explore</button>
          </div>}
        </div>
        {error&&<p role="alert">{error}</p>}
      </div>
    </div>
  </section>;
}
