/**
 * The desktop's accepted portable renderers for `oi.world-presentation/v1`
 * (WORLD-PRESENTATION.md "Safe component rule"): a manifest names a
 * possibility, this client owns which renderer keys it accepts, and an
 * unknown key renders the supplied fallback. No remote module is ever
 * loaded from a manifest; a projected page gains no desktop, filesystem,
 * session or Action authority.
 *
 * The declarative renderer set mirrors the browser Explore registry
 * (`site/src/explore/presentation-components.tsx`) so a Projection reads
 * as one page on both Surfaces. The Expression body is the one living
 * renderer: it resolves the shared `resolveExpressionPresentation` contract
 * against THIS window's Global Expression Stage and renders the live
 * Expression when admitted, the publication's explicit fallback otherwise.
 */
import {useEffect,useLayoutEffect,useMemo,useRef,useState,type CSSProperties,type ReactNode} from "react";
import {useExpressionStage,type StagePresentation} from "../stage/ExpressionStage";
import {useVisuals} from "../visuals/ParticleExpression";
import {expressionConfig} from "../expression/engineProjection";
import type {ExpressionDocument} from "../expression/types";
// @ts-ignore -- the bounded live-embedding law (ES2 anti-recursion).
import {tryAdmitLive} from "../expression/embedding.mjs";
// @ts-ignore -- the language-neutral shared-field contracts are the executable spec.
import {resolveExpressionPresentation} from "../../../../shared-field/expression-presentation.mjs";
// @ts-ignore -- the language-neutral shared-field contracts are the executable spec.
import {LIVE_RENDERER_REF,validateExpressionComposition} from "../../../../shared-field/expression-projection.mjs";
import {RunExpressionBody as FactoryRunExpression} from "../contributions/factory/RunExpressionBody";

export interface PresentationBinding {binding_ref:string;component_ref:string;contribution_ref?:string;surface_ref?:string;projection_ref?:string;subject_ref?:string;portable_renderer?:string;props:Record<string,unknown>;fallback:Record<string,unknown>;provenance:Array<Record<string,unknown>>}
export interface PresentationRegion {region_ref:string;role:string;label?:string;bindings:PresentationBinding[]}
export interface WorldPresentation {schema:"oi.world-presentation/v1";presentation_ref:string;world_ref:string;revision:number;title:string;summary?:string;theme:{name?:string;tokens:Record<string,string>};regions:PresentationRegion[];provenance:Array<Record<string,unknown>>}

/** How this Surface hosts a live Expression: `stage` presents on this
 * window's stage; `preview` shows exactly what a client WITHOUT the live
 * renderer receives (the explicit fallback) and names live eligibility. */
export type ExpressionHosting="stage"|"preview";
interface RendererProps {binding:PresentationBinding;presentationRef:string;onOpenRef?:(ref:string)=>void;hosting:ExpressionHosting}
type Renderer=(props:RendererProps)=>ReactNode;

const textProp=(value:unknown,fallback="")=>typeof value==="string"?value:fallback;
const stringArray=(value:unknown)=>Array.isArray(value)?value.filter((item):item is string=>typeof item==="string"):[];
const recordArray=(value:unknown)=>Array.isArray(value)?value.filter((item):item is Record<string,unknown>=>typeof item==="object"&&item!==null&&!Array.isArray(item)):[];
function safeHref(value:unknown) {
  if(typeof value!=="string")return undefined;
  try{const url=new URL(value,window.location.href);return ["http:","https:","mailto:"].includes(url.protocol)?value:undefined;}catch{return undefined;}
}
function safeMedia(value:unknown) {
  if(typeof value!=="string")return undefined;
  if(/^data:(image\/(png|jpeg|webp|gif)|video\/(mp4|webm));base64,/.test(value))return value;
  try{const url=new URL(value,window.location.href);return ["http:","https:"].includes(url.protocol)?value:undefined;}catch{return undefined;}
}

function Heading({binding}:RendererProps) {
  const eyebrow=textProp(binding.props.eyebrow);const title=textProp(binding.props.title,textProp(binding.fallback.title,binding.component_ref));const copy=textProp(binding.props.copy,textProp(binding.fallback.text));
  return <header className="world-component world-component--heading" data-component-ref={binding.component_ref}>{eyebrow&&<div className="world-component__eyebrow">{eyebrow}</div>}<h2>{title}</h2>{copy&&<p>{copy}</p>}</header>;
}
function Lede({binding}:RendererProps) {
  const title=textProp(binding.props.title,textProp(binding.fallback.title));const body=textProp(binding.props.text,textProp(binding.fallback.text));
  return <header className="world-component world-component--lede" data-component-ref={binding.component_ref}>{title&&<h2>{title}</h2>}{body&&<p>{body}</p>}</header>;
}
function Text({binding}:RendererProps) {
  const title=textProp(binding.props.title,textProp(binding.fallback.title));const body=textProp(binding.props.text,textProp(binding.fallback.text));const html=textProp(binding.props.html);
  return <article className="world-component world-component--text" data-component-ref={binding.component_ref}>{title&&<h3>{title}</h3>}{html?<iframe className="world-component__html" title={title||"Projected prose"} sandbox="" srcDoc={`<!doctype html><meta charset="utf-8"><style>body{margin:0;font:15px/1.6 system-ui,sans-serif;color:inherit}</style>${html}`}/>:<p>{body||"No portable text representation is available."}</p>}</article>;
}
function Distinction({binding}:RendererProps) {
  const title=textProp(binding.props.title,textProp(binding.fallback.title,"Distinction"));const body=textProp(binding.props.text,textProp(binding.fallback.text));const standing=textProp(binding.props.standing,"Key distinction");
  return <article className="world-component world-component--text" data-component-ref={binding.component_ref}><div className="world-component__eyebrow">{standing}</div><h3>{title}</h3>{body&&<p>{body}</p>}</article>;
}
function Collection({binding,onOpenRef}:RendererProps) {
  const title=textProp(binding.props.title,textProp(binding.fallback.title,"Selection"));const items=recordArray(binding.props.items);
  return <section className="world-component world-component--collection" data-component-ref={binding.component_ref}><h3>{title}</h3><div className="world-component__collection">{items.map((item,index)=>{const label=textProp(item.label,textProp(item.ref,`Item ${index+1}`));const ref=textProp(item.ref);const href=safeHref(item.href);const description=textProp(item.description);const content=<><strong>{label}</strong>{description&&<span>{description}</span>}</>;if(ref&&onOpenRef)return <button type="button" key={`${ref}:${index}`} onClick={()=>onOpenRef(ref)}>{content}</button>;if(href)return <a key={`${href}:${index}`} href={href} target="_blank" rel="noreferrer">{content}</a>;return <div key={`${label}:${index}`}>{content}</div>;})}</div></section>;
}
function ReferenceCard({binding,onOpenRef}:RendererProps) {
  const title=textProp(binding.props.title,textProp(binding.fallback.title,"Related material"));const body=textProp(binding.props.text,textProp(binding.fallback.text));const refs=stringArray(binding.props.refs);
  return <section className="world-component world-component--collection" data-component-ref={binding.component_ref} data-subject-ref={binding.subject_ref}><h3>{title}</h3>{body&&<p>{body}</p>}{refs.length>0&&<div className="world-component__refs">{refs.map(ref=><button type="button" key={ref} onClick={()=>onOpenRef?.(ref)}>{ref}</button>)}</div>}</section>;
}
function WikiReading({binding,onOpenRef}:RendererProps) {
  const title=textProp(binding.props.title,textProp(binding.fallback.title,"Wiki reading"));const body=textProp(binding.props.text,textProp(binding.fallback.text));const refs=stringArray(binding.props.refs);
  return <article className="world-component world-component--wiki" data-component-ref={binding.component_ref}><div className="world-component__eyebrow">Wiki reading</div><h3>{title}</h3>{body&&<p>{body}</p>}{refs.length>0&&<div className="world-component__refs">{refs.map(ref=><button type="button" key={ref} onClick={()=>onOpenRef?.(ref)}>{ref}</button>)}</div>}</article>;
}
function ClaimEvidence({binding}:RendererProps) {
  const title=textProp(binding.props.title,textProp(binding.fallback.title,"Claim and evidence"));const claim=textProp(binding.props.claim,textProp(binding.fallback.text));const evidence=stringArray(binding.props.evidence);const standing=textProp(binding.props.standing,"Claim / evidence");
  return <article className="world-component world-component--text" data-component-ref={binding.component_ref}><div className="world-component__eyebrow">{standing}</div><h3>{title}</h3>{claim&&<p>{claim}</p>}{evidence.length>0&&<ul>{evidence.map(item=><li key={item}>{item}</li>)}</ul>}</article>;
}
function Timeline({binding}:RendererProps) {
  const title=textProp(binding.props.title,textProp(binding.fallback.title,"History"));const items=recordArray(binding.props.items);
  return <section className="world-component world-component--text" data-component-ref={binding.component_ref}><h3>{title}</h3>{items.length?<ol>{items.map((item,index)=>{const label=textProp(item.label,textProp(item.time,`Step ${index+1}`));const copy=textProp(item.text,textProp(item.description));return <li key={`${label}:${index}`}><strong>{label}</strong>{copy?` — ${copy}`:""}</li>;})}</ol>:<p>{textProp(binding.fallback.text,"No timeline items are available.")}</p>}</section>;
}
function Diagram({binding}:RendererProps) {
  const title=textProp(binding.props.title,textProp(binding.fallback.title,"Diagram"));const description=textProp(binding.props.description,textProp(binding.fallback.text));const relations=stringArray(binding.props.relations);
  return <figure className="world-component world-component--text" data-component-ref={binding.component_ref}><div className="world-component__eyebrow">Diagram reading</div><h3>{title}</h3>{relations.length>0&&<div className="world-component__collection">{relations.map(relation=><div key={relation}>{relation}</div>)}</div>}{description&&<figcaption>{description}</figcaption>}</figure>;
}
function Comparison({binding}:RendererProps) {
  const title=textProp(binding.props.title,textProp(binding.fallback.title,"Comparison"));const rows=recordArray(binding.props.rows);
  return <section className="world-component world-component--collection" data-component-ref={binding.component_ref}><h3>{title}</h3><div className="world-component__collection">{rows.map((row,index)=>{const label=textProp(row.label,textProp(row.name,`Item ${index+1}`));const value=textProp(row.value,textProp(row.text));return <div key={`${label}:${index}`}><strong>{label}</strong>{value&&<span>{value}</span>}</div>;})}</div></section>;
}
function CodeSchema({binding}:RendererProps) {
  const title=textProp(binding.props.title,textProp(binding.fallback.title,"Code / schema"));const code=textProp(binding.props.code,textProp(binding.fallback.text));const language=textProp(binding.props.language,"Code / schema");
  return <article className="world-component world-component--text" data-component-ref={binding.component_ref}><div className="world-component__eyebrow">{language}</div><h3>{title}</h3><pre><code>{code}</code></pre></article>;
}
function ImageFigure({binding}:RendererProps) {
  const title=textProp(binding.props.title,textProp(binding.fallback.title,"Image"));const caption=textProp(binding.props.caption,textProp(binding.fallback.text));const alt=textProp(binding.props.alt,title);const src=safeMedia(binding.props.src);
  return <figure className="world-component world-component--text" data-component-ref={binding.component_ref}><h3>{title}</h3>{src&&<img src={src} alt={alt} loading="lazy"/>}{caption&&<figcaption>{caption}</figcaption>}</figure>;
}
function Mockup({binding}:RendererProps) {
  const title=textProp(binding.props.title,textProp(binding.fallback.title,"Mockup"));const body=textProp(binding.props.text,textProp(binding.props.description,textProp(binding.fallback.text)));
  return <section className="world-component world-component--text" data-component-ref={binding.component_ref}><div className="world-component__eyebrow">Interface / mockup</div><h3>{title}</h3><div className="world-component__collection"><div>{body}</div></div></section>;
}
function Source({binding}:RendererProps) {
  const title=textProp(binding.props.title,textProp(binding.fallback.title,"Source"));const copy=textProp(binding.props.text,textProp(binding.fallback.text));const href=safeHref(binding.props.href);
  return <article className="world-component world-component--link" data-component-ref={binding.component_ref}><div><strong>{title}</strong>{copy&&<span>{copy}</span>}</div>{href&&<a href={href} target="_blank" rel="noreferrer" aria-label={`Open ${title}`}>↗</a>}</article>;
}
function Action({binding,onOpenRef}:RendererProps) {
  const label=textProp(binding.props.label,textProp(binding.props.title,textProp(binding.fallback.title,"Open")));const ref=textProp(binding.props.ref,textProp(binding.subject_ref));const href=safeHref(binding.props.href);
  return <article className="world-component world-component--link" data-component-ref={binding.component_ref}><div><strong>{label}</strong>{textProp(binding.fallback.text)&&<span>{textProp(binding.fallback.text)}</span>}</div>{ref&&onOpenRef?<button type="button" onClick={()=>onOpenRef(ref)}>Open</button>:href?<a href={href} target="_blank" rel="noreferrer">↗</a>:null}</article>;
}
function Link({binding}:RendererProps) {
  const label=textProp(binding.props.label,textProp(binding.fallback.title,"Open"));const copy=textProp(binding.props.copy,textProp(binding.fallback.text));const href=safeHref(binding.props.href);
  return <article className="world-component world-component--link" data-component-ref={binding.component_ref}><div><strong>{label}</strong>{copy&&<span>{copy}</span>}</div>{href&&<a href={href} target="_blank" rel="noreferrer" aria-label={`Open ${label}`}>↗</a>}</article>;
}
function Fallback({binding}:RendererProps) {
  const title=textProp(binding.fallback.title,binding.component_ref);const text=textProp(binding.fallback.text,"This component is not available on this Surface.");
  return <article className="world-component world-component--fallback" data-component-ref={binding.component_ref} data-renderer-state="fallback"><div className="world-component__eyebrow">Portable fallback</div><h3>{title}</h3><p>{text}</p><code>{binding.component_ref}</code></article>;
}

type Resolved={state:"live";expression:ExpressionReading;renderer_ref:string}|{state:"fallback";expression:ExpressionReading;fallback:{kind:"image"|"video"|"html";representation:{ref:string;revision:string};href?:string;html?:string}}|{state:"unavailable";expression:ExpressionReading;reason:string};
interface ExpressionReading {expression_ref:string;expression_revision:number;scene_ref?:string;live_renderer_ref:string;subjects:{ref:string}[];representations:unknown[]}

/** A presentation may already expose the EX5 element host; on this main it may not. Detected, never assumed. */
type HostablePresentation=StagePresentation&{setContainer?:(container:HTMLElement|null)=>void};
/** The bounded live-embedding receipt (ES2): the anti-recursion law's answer
 * for this placement — a live slot was taken, or the placement resolves to a
 * visible portal with the owner-stated reason. */
type EmbeddingReceipt={admitted:boolean;reason?:string};

/** The living body (WORLD-PRESENTATION.md "Expression Field renderer
 * relation"): the same subject/Expression/revision whether the live
 * renderer is admitted or the explicit fallback renders. Renderer pixels
 * are presentation; the refs on the element are the semantic address. */
function ExpressionBody({binding,presentationRef,hosting}:RendererProps) {
  const stage=useExpressionStage();const {snapshot:visuals}=useVisuals();
  const rendererAdmitted=hosting==="stage"&&visuals.enabled&&!stage.error;
  const resolved=useMemo<Resolved|{state:"malformed";reason:string}>(()=>{
    try{return resolveExpressionPresentation(binding,{renderer_ref:LIVE_RENDERER_REF,available:rendererAdmitted,focus:false,capture:false}) as Resolved;}
    catch(cause){return {state:"malformed",reason:String(cause instanceof Error?cause.message:cause)};}
  },[binding,rendererAdmitted]);
  const composition=useMemo(()=>{
    if(resolved.state!=="live")return null;
    try{return validateExpressionComposition(binding.props.composition) as ExpressionDocument;}catch{return null;}
  },[binding,resolved.state]);
  const [liveError,setLiveError]=useState<string>();
  const [live,setLive]=useState(false);
  /** ES2 anti-recursion receipt: a portal instead of a second engine. */
  const [portal,setPortal]=useState<EmbeddingReceipt>();
  const inline=useRef<HTMLDivElement>(null);const presentation=useRef<HostablePresentation|null>(null);
  const id=`explore:${presentationRef}:${binding.binding_ref}`;
  useEffect(()=>{
    if(resolved.state!=="live")return;
    if(!composition){setLiveError("The carried composition is not admissible on this client");return;}
    // One law guards every live placement: same-expression same-host — or a
    // depth beyond the budget — resolves to a portal, never another engine.
    const embedding=tryAdmitLive(expression.expression_ref) as {admitted:boolean;resolution:{mode:string;reason?:string};release?:()=>void};
    if(!embedding.admitted){setPortal({admitted:false,reason:embedding.resolution.reason});return;}
    setPortal(undefined);
    try{
      const handle=stage.present({id,plane:"overlay",recipe:"",config:expressionConfig(composition),appearance:"host",sceneRef:composition.selection.scene_ref}) as HostablePresentation|null;
      if(!handle)throw new Error(stage.error??"The Expression stage is off, occupied by another presentation in this window, or unavailable");
      presentation.current=handle;
      if(typeof handle.setContainer==="function")handle.setContainer(inline.current);
      setLive(true);setLiveError(undefined);
    }catch(cause){setLive(false);setLiveError(String(cause instanceof Error?cause.message:cause));}
    return()=>{embedding.release?.();presentation.current?.release();presentation.current=null;setLive(false);};
  },[resolved.state,composition,id,stage]);
  useLayoutEffect(()=>{const handle=presentation.current;if(handle&&typeof handle.setContainer==="function")handle.setContainer(inline.current);});
  if(resolved.state==="malformed")return <article className="world-component world-component--fallback" role="alert" data-expression-state="malformed"><div className="world-component__eyebrow">Expression unavailable</div><h3>{textProp(binding.fallback.title,"Expression")}</h3><p>{resolved.reason}</p></article>;
  const expression=resolved.expression;
  const attributes={"data-expression-ref":expression.expression_ref,"data-expression-revision":expression.expression_revision,"data-subject-ref":binding.subject_ref,"data-live-renderer":expression.live_renderer_ref} as const;
  // ES2 anti-recursion: the same Expression is already live on this host (or
  // the depth budget is spent) — a visible portal names the live occurrence
  // instead of instantiating a second engine.
  if(portal&&!portal.admitted){
    return <section className="world-component world-component--expression world-expression__portal" {...attributes} data-expression-state="portal" data-portal-reason={portal.reason}>
      <div className="world-component__eyebrow">Live elsewhere on this surface</div>
      <h3>{textProp(binding.fallback.title,expression.expression_ref)}</h3>
      <p>{portal.reason}. This placement stays a portal to the one live Expression <code>{expression.expression_ref}</code> · revision {expression.expression_revision} — this host never runs a second copy of it.</p>
    </section>;
  }
  if(resolved.state==="live"&&!liveError){
    return <section className="world-component world-component--expression" {...attributes} data-expression-state="live" data-expression-hosting={typeof presentation.current?.setContainer==="function"?"element":"window-stage"}>
      <div ref={inline} className="world-expression__live" aria-label={`Live Expression ${expression.expression_ref}`}>{!live&&<p role="status">Presenting on the stage…</p>}{live&&typeof presentation.current?.setContainer!=="function"&&<p className="world-expression__note">Live on this window's Expression stage · {expression.expression_ref} r{expression.expression_revision}</p>}</div>
      <footer className="world-expression__meta"><span>live · {expression.live_renderer_ref}</span><span>{expression.expression_ref} · revision {expression.expression_revision}</span></footer>
    </section>;
  }
  const fallback=resolved.state==="fallback"?resolved.fallback:(binding.props.expression as {representations?:Array<{kind:string;representation:{ref:string;revision:string;availability:string};href?:string;html?:string}>}|undefined)?.representations?.find(item=>item.representation.availability==="available"&&((item.kind==="html"&&item.html)||((item.kind==="image"||item.kind==="video")&&item.href)));
  const reason=liveError??(resolved.state==="unavailable"?resolved.reason:hosting==="preview"?"preview shows what a client without the live renderer receives":"live renderer not admitted on this Surface");
  if(fallback){
    const href=safeMedia(fallback.href);
    return <figure className="world-component world-component--expression" {...attributes} data-expression-state="fallback" data-fallback-kind={fallback.kind} data-fallback-ref={fallback.representation.ref}>
      {fallback.kind==="image"&&href&&<img src={href} alt={textProp(binding.fallback.title,"Expression capture")}/>}
      {fallback.kind==="video"&&href&&<video src={href} controls preload="metadata"/>}
      {fallback.kind==="html"&&typeof fallback.html==="string"&&<iframe className="world-expression__frozen" title={textProp(binding.fallback.title,"Frozen Expression")} sandbox="" srcDoc={fallback.html}/>}
      <figcaption><span>{fallback.kind} fallback · {fallback.representation.ref} · {fallback.representation.revision}</span><span>{reason}</span></figcaption>
    </figure>;
  }
  return <article className="world-component world-component--fallback" {...attributes} data-expression-state="unavailable"><div className="world-component__eyebrow">Expression unavailable</div><h3>{textProp(binding.fallback.title,expression.expression_ref)}</h3><p>{reason}</p></article>;
}

export const portablePresentationRenderers:Record<string,Renderer>={
  "oi.presentation/heading/v1":Heading,
  "oi.presentation/text/v1":Text,
  "oi.presentation/collection/v1":Collection,
  "oi.presentation/wiki-reading/v1":WikiReading,
  "oi.presentation/link/v1":Link,
  "oi.presentation/lede/v1":Lede,
  "oi.presentation/prose/v1":Text,
  "oi.presentation/distinction/v1":Distinction,
  "oi.presentation/diagram/v1":Diagram,
  "oi.presentation/source/v1":Source,
  "oi.presentation/claim-evidence/v1":ClaimEvidence,
  "oi.presentation/timeline/v1":Timeline,
  "oi.presentation/comparison/v1":Comparison,
  "oi.presentation/code-schema/v1":CodeSchema,
  "oi.presentation/image/v1":ImageFigure,
  "oi.presentation/mockup/v1":Mockup,
  "oi.presentation/wiki-excerpt/v1":WikiReading,
  "oi.presentation/reference-card/v1":ReferenceCard,
  "oi.presentation/run-history/v1":Timeline,
  "oi.presentation/factory-run/v1":FactoryRunExpression,
  "oi.presentation/action/v1":Action,
  "oi.presentation/expression/v1":ExpressionBody,
};

/** World theme tokens remap only the roles WORLD-PRESENTATION.md admits; the shared gold meta-relation stays the host's. */
export function presentationThemeStyle(presentation:WorldPresentation):CSSProperties {
  const style:Record<string,string>={};
  const mapping:Record<string,string>={surface:"--oi-world-surface",foreground:"--oi-world-foreground",muted:"--oi-world-muted",rule:"--oi-world-rule",relation:"--oi-world-relation",focus:"--oi-world-focus",projection:"--oi-world-projection",human:"--oi-world-human",agent:"--oi-world-agent"};
  for(const [token,variable] of Object.entries(mapping))if(presentation.theme.tokens[token])style[variable]=presentation.theme.tokens[token];
  return style as CSSProperties;
}

export function WorldPresentationView({presentation,onOpenRef,hosting="stage"}:{presentation:WorldPresentation;onOpenRef?:(ref:string)=>void;hosting?:ExpressionHosting}) {
  return <article className="world-presentation" data-presentation-ref={presentation.presentation_ref} data-presentation-revision={presentation.revision} data-world-ref={presentation.world_ref} style={presentationThemeStyle(presentation)}>
    <header className="world-presentation__masthead"><div><div className="world-component__eyebrow">Projected world</div><h1>{presentation.title}</h1></div><div className="world-presentation__revision">presentation {presentation.revision}</div>{presentation.summary&&<p>{presentation.summary}</p>}</header>
    {presentation.regions.map(region=><section key={region.region_ref} className="world-region" data-region-ref={region.region_ref} data-region-role={region.role}>
      {region.label&&<div className="world-region__label">{region.label}</div>}
      <div className="world-region__components">{region.bindings.map(binding=>{const key=binding.portable_renderer??binding.component_ref;const Renderer=portablePresentationRenderers[key]??Fallback;return <div key={binding.binding_ref} className="world-binding" data-binding-ref={binding.binding_ref} data-component-ref={binding.component_ref} data-renderer-key={key} data-renderer-available={Boolean(portablePresentationRenderers[key])}><Renderer binding={binding} presentationRef={presentation.presentation_ref} onOpenRef={onOpenRef} hosting={hosting}/></div>;})}</div>
    </section>)}
  </article>;
}
