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
import type {HostedProjection,HostedRelation,HostedStage,SharedFieldReading} from "../knowledge/shared-field";
import {WorldPresentationView,type WorldPresentation,type ExpressionHosting} from "./presentation";
import {KnowledgeEncounter} from "./KnowledgeEncounter";
import type {KnowledgeEncounterView} from "./navigate";
import {ConstituentEncounter,constituentOf,type Reading as ConstituentReading} from "./ConstituentEncounter";
import type {HostedEntry} from "../knowledge/shared-field";
// @ts-ignore -- language-neutral desktop reading over the field client's contracts.
import {primaryProjection,relationsOf} from "./field.mjs";
// @ts-ignore -- the shared knowledge subject grammar also owns constellation focus.
import {isKnowledgeSubject} from "../../../../shared-field/knowledge-encounter.mjs";
// @ts-ignore -- display names remain bound to the admitted owner reading.
import {entryLabel,subjectLabel,subjectKind,relationLabel} from "../../../../shared-field/presentation-text.mjs";
// @ts-ignore -- exact native activity/stage identities share the hosted reading law.
import {expressionActivity} from "../../../../shared-field/activity-liveness.mjs";

export interface WatchControl {available:boolean;watching?:boolean;reason?:string;busy:boolean;error?:string;onToggle:()=>void}
export interface DepthState {relations?:boolean;source?:boolean}

function SparseBody({projection,label}:{projection:HostedProjection;label:string}) {
  const payload=(projection.representation as {payload?:{title?:string;text?:string;meta?:{label:string;value:string}[]}}|undefined)?.payload;
  return <article className="world-presentation world-presentation--sparse" data-representation-kind={String((projection.representation as {kind:string}).kind)}>
    <header className="world-presentation__masthead"><div><h1>{subjectLabel(payload,label)}</h1></div></header>
    <section className="world-region"><div className="world-region__components"><article className="world-component world-component--text"><p>{payload?.text??"No written reading has been shared."}</p>{payload?.meta?.length?<details><summary>Source details</summary><dl className="world-component__meta">{payload.meta.map((row,i)=><div key={i}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl></details>:null}</article></div></section>
  </article>;
}

function RepresentationFallback({projection,label}:{projection:HostedProjection;label:string}) {
  const representation=projection.representation as {kind:string;ref?:string};
  return <article className="world-presentation world-presentation--fallback" data-representation-kind={representation.kind} data-renderer-state="fallback">
    <header className="world-presentation__masthead"><div><h1>{label}</h1></div></header>
    <section className="world-region"><div className="world-region__components"><article className="world-component world-component--fallback"><h3>This shared format cannot be displayed here</h3><p>Open Source to inspect the original publication.</p></article></div></section>
  </article>;
}

export function PresentationBody({reading,relations,entries=[],stages=[],activityLiveness=[],onOpenRef,depth,onDepth,watch,strip,contributions,onSelectSubject,onOpenSession,knowledgeView,onKnowledgeView,hosting="stage"}:{knowledgeView?:KnowledgeEncounterView;onKnowledgeView?:(view:KnowledgeEncounterView)=>void;reading:SharedFieldReading;relations:HostedRelation[];entries?:HostedEntry[];stages?:HostedStage[];activityLiveness?:unknown[];onOpenRef:(ref:string)=>void;depth:DepthState;onDepth:(change:DepthState)=>void;watch?:WatchControl;strip?:ReactNode;contributions?:ReactNode;onSelectSubject?:(ref:string)=>void;onOpenSession?:(reading:ConstituentReading)=>Promise<void>;hosting?:ExpressionHosting}) {
  if(reading.state==="unavailable")return <section className="presentation-body" data-presentation-state="unavailable">{strip}<p role="status" className="explore-unavailable">This shared reading is unavailable. Try refreshing the field.</p><details><summary>Connection details</summary><p>{reading.owner_operation}: {reading.detail}</p></details></section>;
  if(reading.state==="absent")return <section className="presentation-body" data-presentation-state="absent">{strip}<p role="status" className="explore-absent">This subject is not available in the current shared field.</p><details><summary>Source details</summary><p>{reading.target.uri}/{reading.target.database} · <code>{reading.ref}</code></p></details></section>;
  const projection=primaryProjection(reading) as HostedProjection|null;
  const current=projection?.state==="published"?projection:null;
  const representation=current?.representation as {kind:string;payload?:unknown}|undefined;
  const presentation=representation?.kind==="oi.world-presentation/v1"?representation.payload as WorldPresentation:undefined;
  const expression=presentation?.regions.flatMap(region=>region.bindings).find(binding=>(binding.portable_renderer??binding.component_ref)==="oi.presentation/expression/v1");
  const expressionReading=expression?.props.expression as {expression_ref:string;expression_revision:number}|undefined;
  const activity=expressionReading&&presentation?expressionActivity({expression_ref:expressionReading.expression_ref,expression_revision:expressionReading.expression_revision,presentation_ref:presentation.presentation_ref,presentation_revision:presentation.revision,world_ref:reading.entry.world_ref,field_ref:reading.field_ref,activity_ref:typeof reading.entry.meta?.activity_ref==="string"?reading.entry.meta.activity_ref:undefined,stages,entries}) as {state:"bound";entry:HostedEntry}|{state:"unavailable";activity_ref:string|null;reason:string}|{state:"unbound"}:undefined;
  const touching=relationsOf([...relations,...reading.relations.filter(relation=>!relations.some(known=>known.from===relation.from&&known.to===relation.to&&known.relation===relation.relation))],reading.entry.ref) as {relation:string;origin:string;direction:string;other:string}[];
  const neighbourhood=reading.neighbourhood as {resource?:unknown;relations?:{nodes?:{ref:string;label?:string;kind?:string}[];edges?:{from:string;to:string;relation:string}[]};actions?:string[];error?:string}|null;
  const knowledge=isKnowledgeSubject(reading.entry);
  const label=entryLabel(reading.entry,reading.projections);
  const relatedSubjects=[...entries,reading.entry,...(neighbourhood?.relations?.nodes??[])];
  // A chosen world constituent is the primary material; its World page is
  // one step away, never a stand-in for it.
  const constituent=constituentOf(reading.entry,[...relations,...reading.relations],entries.length?entries:[reading.entry],activityLiveness);
  const worldLabel=entries.find(entry=>entry.ref===reading.entry.world_ref)?.label;
  const primary=<>
    {constituent&&!expressionReading&&<ConstituentEncounter reading={constituent} worldLabel={worldLabel} onOpenRef={onOpenRef} onOpenSession={onOpenSession}/>}
    {!projection&&<article className="world-presentation world-presentation--fallback" data-renderer-state="no-projection"><header className="world-presentation__masthead"><div><div className="world-component__eyebrow">Projected subject</div><h1>{label}</h1></div></header><section className="world-region"><div className="world-region__components"><article className="world-component world-component--text"><p>{reading.entry.summary??"No published Projection names this entry or its world yet."}</p></article></div></section></article>}
    {projection&&projection.state!=="published"&&<article className="world-presentation world-presentation--fallback" data-renderer-state="withdrawn"><header className="world-presentation__masthead"><div><div className="world-component__eyebrow">Projection withdrawn</div><h1>{label}</h1></div></header><section className="world-region"><div className="world-region__components"><article className="world-component world-component--text"><p>This shared presentation is no longer available.</p></article></div></section></article>}
    {current&&presentation&&(!constituent||expressionReading)&&<WorldPresentationView presentation={presentation} onOpenRef={onOpenRef} subjects={relatedSubjects} hosting={hosting} onSelectSubject={onSelectSubject} activity={activity?.state==="bound"?{...activity,liveness_rows:activityLiveness,field_ref:reading.field_ref!}:activity?.state==="unavailable"?activity:undefined} context={expressionReading?contributions:undefined}/>}
    {current&&!presentation&&representation?.kind==="oi.sparse-representation/v1"&&<SparseBody projection={current} label={label}/>}
    {current&&!presentation&&representation?.kind!=="oi.sparse-representation/v1"&&<RepresentationFallback projection={current} label={label}/>}
  </>;
  return <section className="presentation-body" data-presentation-state="hosted" data-entry-ref={reading.entry.ref} data-entry-kind={reading.entry.kind} data-world-ref={reading.entry.world_ref} data-projection-ref={projection?.projection_ref} data-projection-revision={projection?.projection_revision} data-projection-state={projection?.state} data-source-system={projection?.source.system} data-source-ref={projection?.source.ref} data-source-revision={projection?.source.revision} data-presentation-ref={presentation?.presentation_ref} data-presentation-revision={presentation?.revision} data-expression-ref={expressionReading?.expression_ref} data-expression-revision={expressionReading?.expression_revision} data-depth-relations={Boolean(depth.relations)} data-depth-source={Boolean(depth.source)}>
    {strip}
    <div className="presentation-planes">
      {depth.relations&&<aside className="presentation-depth presentation-depth--relations" aria-label="Relations of this subject">
        <header><span>Relations</span><button type="button" aria-label="Dismiss relations" onClick={()=>onDepth({relations:false})}>×</button></header>
        <ul className="presentation-relations">{touching.map((row,i)=><li key={i}><button type="button" data-subject-ref={row.other} onClick={()=>onOpenRef(row.other)}>{subjectLabel(relatedSubjects.find(subject=>subject.ref===row.other),`Unnamed related subject ${i+1}`)}</button><small>{row.direction==="out"?"→":"←"} {relationLabel(row.relation)}</small></li>)}</ul>
        {!touching.length&&!reading.relation_errors?.length&&<p className="explore-muted">No hosted relation touches this subject.</p>}
        {!!reading.relation_errors?.length&&<details data-relation-errors={reading.relation_errors.length}><summary>Unavailable relation details</summary><ul>{reading.relation_errors.map((row,index)=><li key={index}><code>{row.relation_ref??"Unidentified source relation"}</code>: {row.detail}</li>)}</ul></details>}
        {neighbourhood?.relations?.nodes?.length?<details><summary>Nearby subjects · {neighbourhood.relations.nodes.length}</summary><ul className="presentation-relations">{neighbourhood.relations.nodes.filter(node=>node.ref!==reading.entry.ref).map((node,index)=><li key={node.ref}><button type="button" data-subject-ref={node.ref} onClick={()=>onOpenRef(node.ref)}>{subjectLabel(node,`Unnamed related subject ${index+1}`)}</button><small>{subjectKind(node.kind)}</small></li>)}</ul></details>:neighbourhood?.error?<p className="explore-muted">Nearby subjects are unavailable.</p>:null}
      </aside>}
      <div className="presentation-main">
        {knowledge&&neighbourhood?<KnowledgeEncounter view={knowledgeView} onView={onKnowledgeView} hosting={hosting} opened={{resource:neighbourhood.resource??reading.entry,relations:neighbourhood.relations??(neighbourhood.error?{error:neighbourhood.error}:undefined),actions:neighbourhood.actions??[],sources:{ref:reading.entry.ref,revision:reading.entry.revision,provenance:reading.entry.provenance}}} page={primary} onOpenRef={onOpenRef}/>:primary}
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
    {!expressionReading&&contributions}
  </section>;
}
