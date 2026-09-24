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
 *
 * World relations: an Expression constructed from a constellation, or
 * shared while this Cradle acts for an occupied Position (its own
 * `aikit whoami` reading), names them as its authoring. When the hosted
 * field already holds that Position / constellation as a World entry, the
 * owner may place the Expression beside that World — in the World's own
 * field, under its unchanged contract — and the publication relates the
 * Expression to them (`oi.world/expresses`, `oi.world/authored-by`).
 */
import {useEffect,useMemo,useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {kernelOp} from "../kernel/bridge";
import {actingPositionRef,entriesWithField,projectedConstellationRef,worldHostFor,type ActingReading} from "./worldAuthoring";
import {useVisuals} from "../visuals/ParticleExpression";
import {useExpressionStage} from "../stage/ExpressionStage";
import type {ExpressionDocument} from "../expression/types";
import {isUnavailable,sharedField,slug,type HostedParticipant,type HostedProjection,type SharedFieldHostedResult,type SharedFieldReading,type SharedFieldSnapshot,type SharedFieldStatus,type SharedFieldUnavailable} from "../knowledge/shared-field";
import {WorldPresentationView,type WorldPresentation} from "./presentation";
import {navigateExplore} from "./navigate";
// @ts-ignore -- shared Projection lifecycle contract.
import {withdrawProjection} from "../../../../shared-field/index.mjs";
// @ts-ignore -- the language-neutral shared-field contracts are the executable spec.
import {LIVE_RENDERER_REF,hostedExpressionArgs,isProtectedRef,projectExpression} from "../../../../shared-field/expression-projection.mjs";
// @ts-ignore -- the language-neutral shared-field contracts are the executable spec.
import {structuredProjectionReading} from "../../../../shared-field/projection-reading.mjs";
// @ts-ignore -- protected Nara publication specializes the same Projection seam.
import {createNaraPresenceConsent,hostedNaraExpressionArgs,isNaraBoundExpression,projectNaraExpression,withdrawNaraProjection} from "../../../../shared-field/nara-expression-projection.mjs";
import "./explore.css";

interface Bundle {schema:string;expression_ref:string;expression_revision:number;world_ref:string;field_ref:string;composition:unknown;expression:{live_renderer_ref:string;representations:{kind:string}[]};presentation:WorldPresentation;projection:{projection_ref:string;projection_revision:number;state:string;subject:{kind:string;ref:string};source:{system:string;ref?:string;revision:string};publisher_participant_ref:string;audience:{visibility:string;refs?:string[]}};entry:{ref:string;kind:string;world_ref:string;label:string};field:unknown;participant:unknown;live:{renderer_ref:string;fallback_kinds:string[]};relations?:{relation:string;to:string}[];omissions:{world_relations?:{relation:string;ref:string;reason:string}[];readings:number;actions:number;scenes:{scene_ref:string;title:string}[];entities:{entity_ref:string;title:string}[];parameters:{entity_ref:string;parameter:string}[];representations:{kind:string;ref?:string}[];sources:{withheld:{ref:string;availability:string;subject:string}[];protected:{ref:string;subject:string}[];unavailable:{ref:string;availability:string;subject:string}[]};provenance:{ref:string;of:string}[]}}
interface AgentReading {projection_ref:string;projection_revision:number;presentation_ref:string;presentation_revision:number;modules:{renderer:string;props:{expression?:{expression_ref:string;expression_revision:number}}}[]}
interface PresenceEdge {kind?:string;to?:string;consent_ref?:string;expression_ref?:string}
interface NaraProjection extends HostedProjection {audience?:{visibility?:string;refs?:string[]};relation_hints?:PresenceEdge[];representation?:{kind?:string;payload?:{presentation_ref?:string}}}
interface RecoveredPresence {projection:NaraProjection;field_ref:string;publisher_identity_ref?:string;target_ref?:string;target_identity_ref?:string}

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
  const nara=isNaraBoundExpression(document);
  const [naraConsent,setNaraConsent]=useState(false);
  const [naraCycle,setNaraCycle]=useState(0);
  const [naraTargetIdentity,setNaraTargetIdentity]=useState("");
  const [withdrawn,setWithdrawn]=useState<{projection:{projection_ref:string;projection_revision:number;state:string};consent:{state:string}}>();
  const [recoveries,setRecoveries]=useState<RecoveredPresence[]>([]);
  const [recoveryBasis,setRecoveryBasis]=useState<RecoveredPresence>();
  const [recoveryState,setRecoveryState]=useState<"pending"|"complete"|"failed">(nara?"pending":"complete");
  const [recoveryError,setRecoveryError]=useState<string>();
  const recovered=recoveries.length===1?recoveries[0]:recoveryBasis;
  // Authoring: the constellation this Expression was constructed from, and the
  // Position this Cradle acts for — each only when native state proves it.
  const constellationRef=useMemo(()=>nara?undefined:projectedConstellationRef(document),[document,nara]);
  const [actingPosition,setActingPosition]=useState<string>();
  useEffect(()=>{if(nara)return;let active=true;void kernelOp(transport,{op:"inhabitation_read",request:{kind:"whoami"}}).then(result=>{if(active&&result.outcome?.result==="inhabitation_reading")setActingPosition(actingPositionRef(result.outcome.data as ActingReading));}).catch(()=>{});return()=>{active=false;};},[transport,nara]);
  const authoring=useMemo(()=>({...(actingPosition?{position_ref:actingPosition}:{}),...(constellationRef?{constellation_ref:constellationRef}:{})}),[actingPosition,constellationRef]);
  const authored=Boolean(authoring.position_ref||authoring.constellation_ref);
  const [worldSnapshot,setWorldSnapshot]=useState<SharedFieldSnapshot>();
  useEffect(()=>{if(!authored)return;let active=true;void sharedField<SharedFieldSnapshot|SharedFieldUnavailable>(transport,{kind:"snapshot"}).then(reading=>{if(active&&!isUnavailable(reading))setWorldSnapshot(reading);}).catch(()=>{});return()=>{active=false;};},[authored,transport]);
  const worldHost=useMemo(()=>worldSnapshot&&authored?worldHostFor(worldSnapshot,authoring):undefined,[worldSnapshot,authored,authoring]);
  const fieldEntries=useMemo(()=>worldSnapshot?entriesWithField(worldSnapshot):[],[worldSnapshot]);
  const [besideWorld,setBesideWorld]=useState(false);
  const placed=besideWorld&&worldHost&&!nara?worldHost:undefined;
  const protectedCandidates=useMemo(()=>{const refs=new Set<string>();for(const entity of Object.values(document.entities))for(const source of entity.subject?.sources??[])if(source.availability==="available"&&isProtectedRef(source.ref))refs.add(source.ref);for(const reading of document.provenance)if(isProtectedRef(reading.ref))refs.add(reading.ref);for(const relation of Object.values(document.relations))for(const reading of relation.provenance)if(isProtectedRef(reading.ref))refs.add(reading.ref);return [...refs];},[document]);
  const applyRecoveredScope=(item:RecoveredPresence)=>{setPublisher(item.publisher_identity_ref??"");setAudienceRefs(item.target_ref??"");setVisibility(item.projection.audience?.visibility??"restricted");setNaraTargetIdentity(item.target_identity_ref??"");};
  const refs=audienceRefs.split(/[\s,]+/).filter(Boolean);
  const preview=useMemo<{bundle?:Bundle;error?:string}>(()=>{
    try{
      const fieldRef=placed?.field_ref??`oi:field:desktop:${slug(document.expression_ref)}`,identity=publisher.trim()||"human:unnamed",participantRef=`participant:${slug(fieldRef)}:${slug(identity)}`;
      const prior=recovered?.projection,priorPresentation=prior?.representation?.kind==="oi.world-presentation/v1"?prior.representation.payload?.presentation_ref:undefined;
      const base={document,selection:{scene_refs:sceneRefs,...(summary.trim()?{summary:summary.trim()}:{}),disclose_sources:discloseSources,include_source_refs:admitted},publisher:{identity_ref:identity},audience:{visibility,...(refs.length?{refs}:{})},field_ref:fieldRef,projection_ref:prior?.projection_ref??`projection:desktop:${slug(document.expression_ref)}:${stamp}`,presentation_ref:priorPresentation??`presentation:desktop:${slug(document.expression_ref)}:${stamp}`,projection_revision:nara?(prior?.state==="withdrawn"?prior.projection_revision+1:prior?.projection_revision??1+naraCycle*2):1,live_renderer_ref:LIVE_RENDERER_REF,...(placed?{world_ref:placed.world_ref,...(placed.field?{field:placed.field}:{})}:{}),...(authored&&!nara?{authoring,field_entries:fieldEntries}:{})};
      const bundle=((nara?projectNaraExpression({...base,consent:createNaraPresenceConsent({consent_ref:`consent:${slug(document.expression_ref)}:${stamp}:${naraCycle}`,participant_ref:participantRef,expression_ref:document.expression_ref,target_ref:refs[0]??"",target_identity_ref:naraTargetIdentity,granted_at:new Date().toISOString(),source_refs:document.provenance.map(item=>item.ref)})}):projectExpression(base)) as unknown) as Bundle;
      return {bundle};
    }catch(cause){return {error:String(cause instanceof Error?cause.message:cause)};}
  },[document,sceneRefs,summary,discloseSources,admitted,publisher,visibility,audienceRefs,stamp,nara,naraCycle,naraTargetIdentity,recovered,placed,authored,authoring,fieldEntries]);
  useEffect(()=>{if(!hosted&&recovered?.projection.state!=="published"){setCreated(undefined);setHosted(undefined);}},[document.expression_ref,document.revision,sceneRefs,summary,discloseSources,admitted,publisher,visibility,audienceRefs,naraTargetIdentity,naraConsent,hosted,recovered,placed,authoring]);
  useEffect(()=>{if(nara)setNaraConsent(false);},[nara,document.expression_ref,document.revision,sceneRefs,publisher,visibility,audienceRefs,naraTargetIdentity]);
  useEffect(()=>{
    if(!created||hostedStatus)return;
    let active=true;
    void sharedField<SharedFieldStatus>(transport,{kind:"status"}).then(s=>{if(active)setHostedStatus(s);}).catch(err=>{if(active)setHostedStatus({state:"unavailable",owner_operation:"shared-field.projection",detail:String(err)});});
    return()=>{active=false;};
  },[created,hostedStatus,transport]);
  const recoverHostedPresence=()=>{
    if(!nara)return;setRecoveryState("pending");setRecoveryError(undefined);let active=true;
    void Promise.all([sharedField<SharedFieldReading>(transport,{kind:"read",ref:document.expression_ref}),sharedField<SharedFieldSnapshot|SharedFieldUnavailable>(transport,{kind:"snapshot"})]).then(([reading,snapshot])=>{
      if(!active)return;
      if(reading.state==="unavailable")throw new Error(`${reading.owner_operation} is unavailable — ${reading.detail}`);
      if(isUnavailable(snapshot))throw new Error(`${snapshot.owner_operation} is unavailable — ${snapshot.detail}`);
      if(reading.state==="absent"){setRecoveries([]);setRecoveryBasis(undefined);setRecoveryState("complete");return;}
      const owned=new Set(reading.my_authority.filter(row=>!row.revoked).map(row=>row.participant_ref));
      const byRef=new Map<string,NaraProjection>();
      for(const item of reading.projections as NaraProjection[]){
        if(item.subject.ref!==document.expression_ref||!owned.has(item.publisher_participant_ref))continue;
        const presence=item.relation_hints?.some(edge=>edge.kind==="consented-presence");
        if(item.state!=="withdrawn"&&!presence)continue;
        const prior=byRef.get(item.projection_ref);if(!prior||item.projection_revision>prior.projection_revision)byRef.set(item.projection_ref,item);
      }
      const collapsed=[...byRef.values()];
      const current=collapsed.filter(item=>item.state==="published");
      const chosen=current.length===1?current[0]:current.length===0&&collapsed.length===1?collapsed[0]:undefined;
      const field_ref=reading.field_ref!;
      const receipt=(projection:NaraProjection):RecoveredPresence=>{const target_ref=projection.relation_hints?.find(edge=>edge.kind==="consented-presence")?.to??projection.audience?.refs?.[0];return {projection,field_ref,publisher_identity_ref:snapshot.participants.find((item:HostedParticipant)=>item.participant_ref===projection.publisher_participant_ref)?.identity.ref,target_ref,target_identity_ref:snapshot.participants.find((item:HostedParticipant)=>item.participant_ref===target_ref)?.identity.ref};};
      const activeReceipts=current.map(receipt),basis=chosen?receipt(chosen):undefined;if(basis)applyRecoveredScope(basis);
      setRecoveries(activeReceipts);setRecoveryBasis(basis);
      if(chosen?.state==="withdrawn")setWithdrawn({projection:chosen,consent:{state:"withdrawn"}});
      setRecoveryState("complete");
    }).catch(cause=>{if(active){setRecoveryError(String(cause instanceof Error?cause.message:cause));setRecoveryState("failed");}});
    return()=>{active=false;};
  };
  useEffect(()=>{const cancel=recoverHostedPresence();return cancel;},[nara,transport,document.expression_ref]);
  const bundle=preview.bundle;
  const locked=busy||Boolean(hosted)||recoveries.length>0||(nara&&recoveryState!=="complete");
  const liveHere=visuals.enabled&&!stage.error;
  const create=()=>{
    setError(undefined);
    if(!publisher.trim()){setError("Name the publishing identity — publication carries its attribution.");return;}
    if(nara&&!naraConsent){setError("Explicit consent is required for this Nara presence relation.");return;}
    if(!bundle){setError(preview.error??"The preview could not be composed");return;}
    setCreated(bundle);
  };
  const publishHosted=async()=>{
    if(!created)return;setBusy(true);setError(undefined);
    try{
      if(nara){
        const granted=(created as Bundle&{nara_presence?:{consent?:{participant_ref?:string;expression_ref?:string;target_ref?:string;target_identity_ref?:string}}}).nara_presence?.consent;
        const current=(bundle as Bundle&{nara_presence?:{consent?:{participant_ref?:string;expression_ref?:string;target_ref?:string;target_identity_ref?:string}}}|undefined)?.nara_presence?.consent;
        if(!naraConsent||!granted||!current||granted.participant_ref!==current.participant_ref||granted.expression_ref!==current.expression_ref||granted.target_ref!==current.target_ref||granted.target_identity_ref!==current.target_identity_ref)throw new Error("Nara presence consent changed; create a new Projection before publishing.");
      }
      setHosted(await sharedField<SharedFieldHostedResult>(transport,{kind:"publish",args:nara?hostedNaraExpressionArgs(created):hostedExpressionArgs(created)}));
    }
    catch(err){setError(String(err instanceof Error?err.message:err));}
    finally{setBusy(false);}
  };
  const withdrawPresence=async(selected?:RecoveredPresence)=>{
    const receipt=selected??recovered;const active=created?.projection??receipt?.projection;if(!nara||!active)return;setBusy(true);setError(undefined);
    try{
      const at=new Date().toISOString();let projection:NaraProjection,consent:{state:string};
      if(created){const lifecycle=withdrawNaraProjection(created,(created as Bundle&{nara_presence:{consent:unknown}}).nara_presence.consent,{withdrawn_at:at,withdrawal_ref:`withdrawal:${slug(document.expression_ref)}:${stamp}:${naraCycle}`});projection=lifecycle.projection;consent=lifecycle.consent;}
      else{const raw=withdrawProjection(active,{published_at:at,reason:"Nara shared-presence consent withdrawn"}) as NaraProjection;const {relation_hints:_expired,...safe}=raw;projection=safe;consent={state:"withdrawn"};}
      const field_ref=receipt?.field_ref??created?.field_ref;if(hosted||receipt)await sharedField(transport,{kind:"projection",field_ref,projection});
      setWithdrawn({projection,consent});setRecoveryBasis({...receipt,projection,field_ref:field_ref!});setRecoveries(current=>{const remaining=current.filter(item=>item.projection.projection_ref!==projection.projection_ref);if(remaining.length===1)applyRecoveredScope(remaining[0]);return remaining;});setCreated(undefined);setNaraConsent(false);setHosted(undefined);
    }catch(err){setError(String(err instanceof Error?err.message:err));}finally{setBusy(false);}
  };
  const reenter=()=>{setWithdrawn(undefined);setCreated(undefined);setHosted(undefined);setNaraCycle(value=>value+1);setNaraConsent(false);};
  const openInExplore=()=>{if(!created)return;navigateExplore({ref:created.entry.ref});window.dispatchEvent(new CustomEvent("oi:open-explore",{detail:{ref:created.entry.ref,title:created.entry.label}}));};
  const bound=hostedStatus&&"bound" in hostedStatus&&hostedStatus.bound?hostedStatus:undefined;
  const absentReason=hostedStatus?("bound" in hostedStatus?(hostedStatus.bound?"":hostedStatus.reason):hostedStatus.detail):"";
  const agentReading=useMemo<AgentReading|undefined>(()=>{if(!created)return undefined;try{return structuredProjectionReading(created.projection) as AgentReading;}catch{return undefined;}},[created]);
  const agentSummary=agentReading?{projection_ref:agentReading.projection_ref,projection_revision:agentReading.projection_revision,presentation_ref:agentReading.presentation_ref,presentation_revision:agentReading.presentation_revision,expression:agentReading.modules.find(m=>m.renderer==="oi.presentation/expression/v1")?.props.expression}:undefined;
  const o=bundle?.omissions;
  return <section className="share-projection" aria-label="Share / Project" data-expression-ref={document.expression_ref} data-expression-revision={document.revision} data-preview-projection-ref={bundle?.projection.projection_ref} data-created={Boolean(created)} data-hosted={Boolean(hosted)} data-acting-position={actingPosition??""} data-constellation-ref={constellationRef??""} data-world-relations={(bundle?.relations??[]).map(relation=>relation.relation).join(",")}>
    <header className="share-head"><div><small>Share / Project</small><strong>{document.title}</strong><span>{document.expression_ref} · revision {document.revision}</span></div><button type="button" aria-label="Close share" disabled={busy} onClick={onClose}>×</button></header>
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
            {(o.world_relations??[]).map((w,i)=><li key={`r${i}`} data-omission="world-relation">{w.relation} to <code>{w.ref}</code> not published: {w.reason}</li>)}
          </ul>}
        </section>
        <section className="share-selection" aria-label="Selection">
          <h3>Selection</h3>
          <div className="share-scenes">{document.scenes.map(scene=><label key={scene.scene_ref}><input type="checkbox" disabled={locked} checked={sceneRefs.includes(scene.scene_ref)} onChange={e=>setSceneRefs(current=>e.target.checked?[...current,scene.scene_ref].filter((r,i,a)=>a.indexOf(r)===i):current.filter(r=>r!==scene.scene_ref))}/>{scene.title}</label>)}</div>
          <label>Source refs<select aria-label="Disclose source refs" disabled={locked} value={discloseSources} onChange={e=>setDiscloseSources(e.target.value as "available"|"none")}><option value="available">available, non-protected</option><option value="none">none</option></select></label>
          {protectedCandidates.length>0&&<div className="share-admit"><span>Admit protected refs explicitly</span>{protectedCandidates.map(ref=><label key={ref}><input type="checkbox" disabled={locked} checked={admitted.includes(ref)} onChange={e=>setAdmitted(current=>e.target.checked?[...current,ref]:current.filter(r=>r!==ref))}/><code>{ref}</code></label>)}</div>}
          <label>Summary<input aria-label="Projection summary" disabled={locked} value={summary} onChange={e=>setSummary(e.target.value)} placeholder="one line another world reads first" autoComplete="off" spellCheck={false}/></label>
        </section>
        <section className="share-audience" aria-label="Audience">
          <h3>Audience</h3>
          <label>Visibility<select aria-label="Projection visibility" disabled={locked} value={visibility} onChange={e=>setVisibility(e.target.value)}>{["public","unlisted","restricted","private"].map(v=><option key={v} value={v}>{v}</option>)}</select></label>
          <label>Audience participants<input aria-label="Audience participants" disabled={locked} value={audienceRefs} onChange={e=>setAudienceRefs(e.target.value)} placeholder="comma-separated participant refs (restricted / private)" autoComplete="off" spellCheck={false}/></label>
          <label>Publish as<input aria-label="Publisher identity" disabled={locked} value={publisher} onChange={e=>setPublisher(e.target.value)} placeholder="your identity ref (e.g. human:…) — the field-scoped participant is derived" autoComplete="off" spellCheck={false}/></label>
          {nara&&<div className="share-nara-consent" data-nara-protected="true" data-consent-state={withdrawn?"withdrawn":naraConsent?"granted":"absent"}>
            <strong>Protected Nara presence</strong>
            <p>This publishes the authored seven-centre and distinct EarthBody cues, source/Epi refs and fallback. Personal readings, resonance values, body state, journal/activity, Agent context and renderer state remain withheld.</p>
            <label><input type="checkbox" checked={naraConsent||recoveries.length>0} disabled={Boolean(withdrawn)||locked} onChange={event=>setNaraConsent(event.target.checked)}/>I explicitly consent to share this Expression presence with <code>{refs[0]||"the named target Participant"}</code>.</label>
            <label>Target identity<input aria-label="Nara target identity" disabled={locked} value={naraTargetIdentity} onChange={event=>setNaraTargetIdentity(event.target.value)} placeholder="the Human identity behind the target Participant"/></label>
          </div>}
          {worldHost&&!nara&&<label className="share-beside-world" data-world-field={worldHost.field_ref} data-world-ref={worldHost.world_ref}><input type="checkbox" aria-label="Place beside its World" disabled={locked} checked={besideWorld} onChange={e=>setBesideWorld(e.target.checked)}/>Place beside <strong>{worldHost.label}</strong> in its field <code>{worldHost.field_ref}</code>, related to {[worldHost.hosts.position?<>the Position <code key="p">{authoring.position_ref}</code></>:null,worldHost.hosts.constellation?<>the constellation <code key="c">{authoring.constellation_ref}</code></>:null].filter(Boolean).map((part,i)=><span key={i}>{i?" and ":""}{part}</span>)} it already hosts. The field keeps its own title and visibility.</label>}
          {bundle&&<p className="share-destination">World <code>{bundle.world_ref}</code> · field <code>{bundle.field_ref}</code> · projection <code>{bundle.projection.projection_ref}</code>{bundle.relations?.length?<> · {bundle.relations.map(relation=>relation.relation).join(", ")}</>:null}</p>}
        </section>
        <div className="share-actions">
          <button type="button" className="share-create" disabled={!bundle||!!created||locked} onClick={create}>Create Projection</button>
          {created&&<div className="share-created" data-projection-ref={created.projection.projection_ref} data-projection-revision={created.projection.projection_revision} data-projection-state={created.projection.state} data-presentation-ref={created.presentation.presentation_ref} data-presentation-revision={created.presentation.revision} data-source-revision={created.projection.source.revision} data-projection={JSON.stringify(created.projection)}>
            <p role="status">Projection <code>{created.projection.projection_ref}</code> · revision {created.projection.projection_revision} · {created.projection.state} — subject <code>{created.projection.subject.ref}</code> at source revision {created.projection.source.revision}; presentation <code>{created.presentation.presentation_ref}</code> revision {created.presentation.revision}; audience {created.projection.audience.visibility}{created.projection.audience.refs?`: ${created.projection.audience.refs.join(", ")}`:""}; published by {created.projection.publisher_participant_ref} (identity {publisher.trim()}). The Expression itself is unchanged at revision {created.expression_revision}.</p>
            {agentSummary&&<details className="share-agent-reading"><summary>Structured reading (what an Agent receives)</summary><pre data-agent-reading={JSON.stringify(agentSummary)}>{JSON.stringify(agentSummary,null,2)}</pre></details>}
            {!hosted&&bound&&<div className="share-host" data-hosted-target={`${bound.target.uri}/${bound.target.database}`}><span>Hosting target <code>{bound.target.name}</code> ({bound.target.uri}/{bound.target.database}) is bound. Publishing places this Projection, its field, its publisher and one Explore entry there{created.relations?.length?`, with ${created.relations.length} World relation${created.relations.length===1?"":"s"} (${created.relations.map(relation=>relation.relation).join(", ")})`:""} — visible to the {created.projection.audience.visibility} audience.</span><button type="button" className="share-host-send" disabled={busy} onClick={()=>void publishHosted()}>{busy?"Publishing to the hosted field…":"Publish to the hosted field"}</button></div>}
            {!hosted&&hostedStatus&&!bound&&<p className="share-host-absent" role="status" data-hosted-bound="false">No hosting target is bound for this desktop — {absentReason}. The Projection remains local beside this Expression; nothing was sent.</p>}
            {hosted&&<div className="share-hosted" data-hosted-result={JSON.stringify(hosted)} data-hosted-projection-ref={hosted.hosted_projection_row.projectionRef} data-hosted-entry-ref={hosted.entries[0]??""}><p role="status">Hosted in <code>{hosted.target.name}</code>: projection row <code>{hosted.hosted_projection_row.projectionKey}</code> · revision {hosted.hosted_projection_row.projectionRevision} · source revision {hosted.hosted_projection_row.sourceRevision} · {hosted.hosted_projection_row.state}; entry <code>{hosted.entries[0]}</code>; transport identity <code>{hosted.transport_identity}</code> — the client's connection identity, not a human participant.</p></div>}
            <button type="button" className="share-open-explore" disabled={!hosted} title={hosted?"Encounter the hosted representation in Explore":"Open in Explore needs the hosted field; publish first"} onClick={openInExplore}>Open in Explore</button>
            {nara&&!withdrawn&&<button type="button" className="share-withdraw-presence" disabled={busy} onClick={()=>void withdrawPresence()}>Withdraw Nara presence</button>}
          </div>}
          {nara&&recoveryState==="pending"&&<p className="share-recovery-pending" role="status">Checking the hosted field for an existing Nara presence before publication…</p>}
          {nara&&recoveryState==="failed"&&<div className="share-recovery-failed" role="alert"><p>Hosted consent recovery could not establish the current state: {recoveryError}. Publication remains locked.</p><button type="button" disabled={busy} onClick={recoverHostedPresence}>Retry hosted consent recovery</button></div>}
          {!created&&recoveries.map(item=><div key={item.projection.projection_ref} className="share-recovered" data-projection-ref={item.projection.projection_ref} data-projection-revision={item.projection.projection_revision}><p role="status">Recovered your hosted Nara presence <code>{item.projection.projection_ref}</code> at Projection revision {item.projection.projection_revision}. Its published scope is frozen until withdrawal.</p><button type="button" className="share-withdraw-presence" disabled={busy} onClick={()=>void withdrawPresence(item)}>{recoveries.length===1?"Withdraw Nara presence":`Withdraw ${item.projection.projection_ref}`}</button></div>)}
          {withdrawn&&recoveries.length===0&&<div className="share-withdrawn" data-projection-ref={withdrawn.projection.projection_ref} data-projection-revision={withdrawn.projection.projection_revision} data-consent-state={withdrawn.consent.state}><p role="status">Consent withdrawn. Projection revision {withdrawn.projection.projection_revision} is withdrawn and cannot be reused.</p><button type="button" onClick={reenter}>Re-enter with new consent</button></div>}
        </div>
        {error&&<p role="alert">{error}</p>}
      </div>
    </div>
  </section>;
}
