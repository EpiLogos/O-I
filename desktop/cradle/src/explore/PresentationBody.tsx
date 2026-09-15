/**
 * One projected subject as the primary canvas body (SHARED-FIELD-DESKTOP §3):
 * the hosted reading's primary Projection rendered through the accepted
 * portable renderers, with source/provenance and relation depth summoned
 * INSIDE this Surface and dismissed again — never a second inspector shell.
 * Every semantic address rides on the element as data: the human reading
 * and the structured reading name the same World/Projection/Presentation/
 * Expression refs and revisions.
 */
import type {ReactNode} from "react";
import type {HostedProjection,HostedRelation,SharedFieldReading} from "../knowledge/shared-field";
import {WorldPresentationView,type WorldPresentation} from "./presentation";
import {KnowledgeEncounter} from "./KnowledgeEncounter";
// @ts-ignore -- language-neutral desktop reading over the field client's contracts.
import {primaryProjection,relationsOf} from "./field.mjs";

export interface WatchControl {available:boolean;watching?:boolean;reason?:string;busy:boolean;error?:string;onToggle:()=>void}
export interface DepthState {relations?:boolean;source?:boolean}

function SparseBody({projection}:{projection:HostedProjection}) {
  const payload=(projection.representation as {payload?:{title?:string;text?:string;meta?:{label:string;value:string}[]}}|undefined)?.payload;
  return <article className="world-presentation world-presentation--sparse" data-representation-kind={String((projection.representation as {kind:string}).kind)}>
    <header className="world-presentation__masthead"><div><div className="world-component__eyebrow">Projected reading</div><h1>{payload?.title??String(projection.subject.ref)}</h1></div></header>
    <section className="world-region"><div className="world-region__components"><article className="world-component world-component--text"><p>{payload?.text??"This Projection carries a sparse reading without text."}</p>{payload?.meta?.length?<dl className="world-component__meta">{payload.meta.map((row,i)=><div key={i}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>:null}</article></div></section>
  </article>;
}

function RepresentationFallback({projection}:{projection:HostedProjection}) {
  const representation=projection.representation as {kind:string;ref?:string};
  return <article className="world-presentation world-presentation--fallback" data-representation-kind={representation.kind} data-renderer-state="fallback">
    <header className="world-presentation__masthead"><div><div className="world-component__eyebrow">Projected subject</div><h1>{String(projection.subject.ref)}</h1></div></header>
    <section className="world-region"><div className="world-region__components"><article className="world-component world-component--fallback"><div className="world-component__eyebrow">Portable fallback</div><h3>This desktop does not admit the representation kind</h3><p>{representation.kind}{representation.ref?` · ${representation.ref}`:""}. The Projection stays what it is; only this Surface's renderer is missing.</p></article></div></section>
  </article>;
}

export function PresentationBody({reading,relations,onOpenRef,depth,onDepth,watch,strip}:{reading:SharedFieldReading;relations:HostedRelation[];onOpenRef:(ref:string)=>void;depth:DepthState;onDepth:(change:DepthState)=>void;watch?:WatchControl;strip?:ReactNode}) {
  if(reading.state==="unavailable")return <section className="presentation-body" data-presentation-state="unavailable"><p role="status" className="explore-unavailable">{reading.owner_operation} is unavailable — {reading.detail}</p></section>;
  if(reading.state==="absent")return <section className="presentation-body" data-presentation-state="absent"><p role="status" className="explore-absent">The field at {reading.target.uri}/{reading.target.database} holds no entry for <code>{reading.ref}</code>.</p></section>;
  const projection=primaryProjection(reading) as HostedProjection|null;
  const representation=projection?.representation as {kind:string;payload?:unknown}|undefined;
  const presentation=representation?.kind==="oi.world-presentation/v1"?representation.payload as WorldPresentation:undefined;
  const expression=presentation?.regions.flatMap(region=>region.bindings).find(binding=>(binding.portable_renderer??binding.component_ref)==="oi.presentation/expression/v1");
  const expressionReading=expression?.props.expression as {expression_ref:string;expression_revision:number}|undefined;
  const touching=relationsOf([...relations,...reading.relations.filter(relation=>!relations.some(known=>known.from===relation.from&&known.to===relation.to&&known.relation===relation.relation))],reading.entry.ref) as {relation:string;origin:string;direction:string;other:string}[];
  const neighbourhood=reading.neighbourhood as {resource?:unknown;relations?:{nodes?:{ref:string;label?:string;kind?:string}[];edges?:{from:string;to:string;relation:string}[]};actions?:string[];error?:string}|null;
  const knowledge=reading.entry.kind==="wiki-node"||reading.entry.kind==="wiki-space";
  const primary=<>
    {!projection&&<article className="world-presentation world-presentation--fallback" data-renderer-state="no-projection"><header className="world-presentation__masthead"><div><div className="world-component__eyebrow">Projected subject</div><h1>{reading.entry.label}</h1></div></header><section className="world-region"><div className="world-region__components"><article className="world-component world-component--text"><p>{reading.entry.summary??"No published Projection names this entry or its world yet."}</p></article></div></section></article>}
    {projection&&presentation&&<WorldPresentationView presentation={presentation} onOpenRef={onOpenRef}/>}
    {projection&&!presentation&&representation?.kind==="oi.sparse-representation/v1"&&<SparseBody projection={projection}/>}
    {projection&&!presentation&&representation?.kind!=="oi.sparse-representation/v1"&&<RepresentationFallback projection={projection}/>}
  </>;
  return <section className="presentation-body" data-presentation-state="hosted" data-entry-ref={reading.entry.ref} data-entry-kind={reading.entry.kind} data-world-ref={reading.entry.world_ref} data-projection-ref={projection?.projection_ref} data-projection-revision={projection?.projection_revision} data-projection-state={projection?.state} data-source-system={projection?.source.system} data-source-ref={projection?.source.ref} data-source-revision={projection?.source.revision} data-presentation-ref={presentation?.presentation_ref} data-presentation-revision={presentation?.revision} data-expression-ref={expressionReading?.expression_ref} data-expression-revision={expressionReading?.expression_revision} data-depth-relations={Boolean(depth.relations)} data-depth-source={Boolean(depth.source)}>
    {strip}
    <div className="presentation-planes">
      {depth.relations&&<aside className="presentation-depth presentation-depth--relations" aria-label="Relations of this subject">
        <header><span>Relations</span><button type="button" aria-label="Dismiss relations" onClick={()=>onDepth({relations:false})}>×</button></header>
        <ul className="presentation-relations">{touching.map((row,i)=><li key={i}><button type="button" onClick={()=>onOpenRef(row.other)}>{row.other}</button><small>{row.direction==="out"?"→":"←"} {row.relation} · {row.origin}</small></li>)}</ul>
        {!touching.length&&<p className="explore-muted">No hosted relation touches this subject.</p>}
        {neighbourhood?.relations?.nodes?.length?<details><summary>Bounded neighbourhood · {neighbourhood.relations.nodes.length}</summary><ul className="presentation-relations">{neighbourhood.relations.nodes.filter(node=>node.ref!==reading.entry.ref).map(node=><li key={node.ref}><button type="button" onClick={()=>onOpenRef(node.ref)}>{node.label??node.ref}</button><small>{node.kind??""}</small></li>)}</ul></details>:neighbourhood?.error?<p className="explore-muted">Neighbourhood: {neighbourhood.error}</p>:null}
      </aside>}
      <div className="presentation-main">
        {knowledge&&neighbourhood?<KnowledgeEncounter opened={{resource:neighbourhood.resource??reading.entry,relations:neighbourhood.relations??(neighbourhood.error?{error:neighbourhood.error}:undefined),actions:neighbourhood.actions??[],sources:{ref:reading.entry.ref,revision:reading.entry.revision,provenance:reading.entry.provenance}}} page={primary} onOpenRef={onOpenRef}/>:primary}
      </div>
      {depth.source&&<aside className="presentation-depth presentation-depth--source" aria-label="Source and provenance of this subject">
        <header><span>Source &amp; provenance</span><button type="button" aria-label="Dismiss source and provenance" onClick={()=>onDepth({source:false})}>×</button></header>
        <dl className="presentation-provenance">
          <dt>Subject</dt><dd><code>{reading.entry.ref}</code> · {reading.entry.kind}</dd>
          <dt>World</dt><dd><code>{reading.entry.world_ref}</code></dd>
          {reading.entry.revision&&<><dt>Entry revision</dt><dd>{reading.entry.revision}</dd></>}
          {projection&&<><dt>Projection</dt><dd><code>{projection.projection_ref}</code> · revision {projection.projection_revision} · {projection.state}</dd><dt>Source</dt><dd>{projection.source.system}{projection.source.ref?<> · <code>{projection.source.ref}</code></>:null} · revision <code>{projection.source.revision}</code></dd><dt>Published by</dt><dd>{projection.publisher_participant_ref} · {projection.published_at}</dd><dt>Audience</dt><dd>{String((projection.audience as {visibility?:string}|undefined)?.visibility??"unknown")}{Array.isArray((projection.audience as {refs?:string[]}|undefined)?.refs)?` · ${((projection.audience as {refs:string[]}).refs).join(", ")}`:""}</dd></>}
          {presentation&&<><dt>Presentation</dt><dd><code>{presentation.presentation_ref}</code> · revision {presentation.revision}</dd></>}
          {expressionReading&&<><dt>Expression</dt><dd><code>{expressionReading.expression_ref}</code> · revision {expressionReading.expression_revision}</dd></>}
          <dt>Hosted at</dt><dd>{reading.target.name} · {reading.target.uri}/{reading.target.database}{reading.field_ref?<> · field <code>{reading.field_ref}</code></>:null}</dd>
          <dt>Membership</dt><dd>{reading.my_authority?.length?reading.my_authority.map(row=>`${row.participant_ref} · ${row.role}${row.revoked?" (revoked)":""}`).join("; "):"no authority for this identity in this field"}</dd>
          {watch&&<><dt>Watch</dt><dd data-watch-state={watch.available?(watch.watching?"active":"none"):"unavailable"}>{watch.available?watch.watching?"watching":"not watching":`unavailable — ${watch.reason}`}</dd></>}
        </dl>
        <details><summary>Provenance rows</summary><ul className="presentation-provenance-rows">{(reading.entry.provenance as {kind:string;ref:string;source_system:string;revision?:string}[]??[]).map((row,i)=><li key={i}>{row.kind} · <code>{row.ref}</code> · {row.source_system}{row.revision?` · ${row.revision}`:""}</li>)}{(projection?.provenance as {kind:string;ref:string;source_system:string;revision?:string}[]??[]).map((row,i)=><li key={`p${i}`}>{row.kind} · <code>{row.ref}</code> · {row.source_system}{row.revision?` · ${row.revision}`:""}</li>)}</ul></details>
        <details><summary>Full hosted reading</summary><pre>{JSON.stringify({entry:reading.entry,projections:reading.projections.map(p=>({projection_ref:p.projection_ref,projection_revision:p.projection_revision,state:p.state,subject:p.subject,source:p.source,representation:(p.representation as {kind:string}).kind})),relations:reading.relations,contributions:reading.contributions},null,2)}</pre></details>
      </aside>}
    </div>
  </section>;
}
