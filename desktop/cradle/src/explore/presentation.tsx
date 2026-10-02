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
import {useEffect,useLayoutEffect,useMemo,useRef,useState,useId,type CSSProperties,type ReactNode} from "react";
import {useExpressionStage,type StagePresentation} from "../stage/ExpressionStage";
import {useVisuals} from "../visuals/ParticleExpression";
import {expressionRenderConfig} from "../expression/engineProjection";
import type {StageScene} from "@epilogos/oi-design-system/expressions-engine/shell/nativeBridge.mjs";
import type {ExpressionDocument} from "../expression/types";
import {paintText} from "@epilogos/oi-design-system/expressions-engine/shell/capture.mjs";
// @ts-ignore -- the bounded live-embedding law (ES2 anti-recursion).
import {tryAdmitLive,onLiveEmbeddingReleased} from "../expression/embedding.mjs";
// @ts-ignore -- the language-neutral shared-field contracts are the executable spec.
import {resolveExpressionPresentation} from "../../../../shared-field/expression-presentation.mjs";
// @ts-ignore -- the language-neutral shared-field contracts are the executable spec.
import {LIVE_RENDERER_REF,validateExpressionComposition} from "../../../../shared-field/expression-projection.mjs";
import {RunExpressionBody as FactoryRunExpression} from "../contributions/factory/RunExpressionBody";
// @ts-ignore -- names resolve only against the supplied owner reading.
import {subjectLabel,referenceLabels} from "../../../../shared-field/presentation-text.mjs";
// @ts-ignore -- producer freshness is the shared reading, not renderer state.
import {activityReading} from "../../../../shared-field/activity-liveness.mjs";
import type {HostedEntry} from "../knowledge/shared-field";

export interface PresentationBinding {binding_ref:string;component_ref:string;contribution_ref?:string;surface_ref?:string;projection_ref?:string;subject_ref?:string;portable_renderer?:string;props:Record<string,unknown>;fallback:Record<string,unknown>;provenance:Array<Record<string,unknown>>}
export interface PresentationRegion {region_ref:string;role:string;label?:string;bindings:PresentationBinding[]}
export interface WorldPresentation {schema:"oi.world-presentation/v1";presentation_ref:string;world_ref:string;revision:number;title:string;summary?:string;theme:{name?:string;tokens:Record<string,string>};regions:PresentationRegion[];provenance:Array<Record<string,unknown>>}

/** How this Surface hosts a live Expression: `stage` presents on this
 * window's stage; `preview` shows exactly what a client WITHOUT the live
 * renderer receives (the explicit fallback) and names live eligibility. */
export type ExpressionHosting="stage"|"preview";
type ProducerBinding={state:"bound";entry:HostedEntry;liveness_rows:unknown[];field_ref:string}|{state:"unavailable";activity_ref:string|null;reason:string};
interface RendererProps {binding:PresentationBinding;presentationRef:string;onOpenRef?:(ref:string)=>void;hosting:ExpressionHosting;subjects?:{ref:string;label?:string;title?:string;legacySummary?:string}[];context?:ReactNode;onSelectSubject?:(ref:string)=>void;activity?:ProducerBinding}
type Renderer=(props:RendererProps)=>ReactNode;

const textProp=(value:unknown,fallback="")=>typeof value==="string"?value:fallback;
const stringArray=(value:unknown)=>Array.isArray(value)?value.filter((item):item is string=>typeof item==="string"):[];
const recordArray=(value:unknown)=>Array.isArray(value)?value.filter((item):item is Record<string,unknown>=>typeof item==="object"&&item!==null&&!Array.isArray(item)):[];
/** Only an admitted, exact Expression composition supplies bound names. Other
 * portable props are opaque to this reader, including unknown renderers. */
function bindingComposition(binding:PresentationBinding):ExpressionDocument|null {
  if((binding.portable_renderer??binding.component_ref)!=="oi.presentation/expression/v1")return null;
  try{
    const document=validateExpressionComposition(binding.props.composition) as ExpressionDocument;
    const resolved=resolveExpressionPresentation(binding,{renderer_ref:LIVE_RENDERER_REF,available:false});
    return document.expression_ref===resolved.expression.expression_ref&&document.revision===resolved.expression.expression_revision?document:null;
  }catch{return null;}
}
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
  const eyebrow=textProp(binding.props.eyebrow);const title=subjectLabel(binding.props,subjectLabel(binding.fallback,"Untitled section"));const copy=textProp(binding.props.copy,textProp(binding.fallback.text));
  return <header className="world-component world-component--heading" data-component-ref={binding.component_ref}>{eyebrow&&<div className="world-component__eyebrow">{eyebrow}</div>}<h2>{title}</h2>{copy&&<p>{copy}</p>}</header>;
}
function Lede({binding}:RendererProps) {
  const title=textProp(binding.props.title,textProp(binding.fallback.title));const body=textProp(binding.props.text,textProp(binding.fallback.text));
  return <header className="world-component world-component--lede" data-component-ref={binding.component_ref}>{title&&<h2>{title}</h2>}{body&&<p>{body}</p>}</header>;
}
export function PortableProse({html,title}:{html:string;title:string}) {
  const frame=useRef<HTMLIFrameElement>(null);
  const [height,setHeight]=useState(240);
  const observer=useRef<ResizeObserver>();
  useEffect(()=>{
    const theme=new MutationObserver(()=>{
      const element=frame.current,body=element?.contentDocument?.body;
      if(element&&body)body.style.color=getComputedStyle(element).color;
    });
    theme.observe(document.body,{attributes:true,attributeFilter:['data-theme','data-oi-theme']});
    return()=>{observer.current?.disconnect();theme.disconnect();};
  },[]);
  const measure=()=>{
    observer.current?.disconnect();
    const body=frame.current?.contentDocument?.body;
    if(!body)return;
    body.style.color=getComputedStyle(frame.current!).color;
    const resize=()=>setHeight(Math.min(8000,Math.max(120,Math.ceil(body.getBoundingClientRect().height)+24)));
    observer.current=new ResizeObserver(resize);observer.current.observe(body);resize();
  };
  // Only same-origin measurement is allowed. Scripts, forms and popups stay
  // sandboxed; carried prose acquires no native operation or desktop authority.
  return <iframe ref={frame} className="world-component__html" title={title||"Projected prose"} sandbox="allow-same-origin" style={{height}} onLoad={measure} srcDoc={`<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><style>body{margin:0;font:15px/1.6 system-ui,sans-serif;overflow-wrap:anywhere}header{font-size:11px;opacity:.65;margin:0 0 1em}p,ul,ol{margin:0 0 1em}h1,h2,h3{line-height:1.2}pre{white-space:pre-wrap}a{color:inherit}</style>${html}`}/>;
}
function Text({binding}:RendererProps) {
  const title=textProp(binding.props.title,textProp(binding.fallback.title));const body=textProp(binding.props.text,textProp(binding.fallback.text));const html=textProp(binding.props.html);
  return <article className="world-component world-component--text" data-component-ref={binding.component_ref}>{title&&<h3>{title}</h3>}{html?<PortableProse html={html} title={title}/>:<p>{body||"No portable text representation is available."}</p>}</article>;
}
function Distinction({binding}:RendererProps) {
  const title=textProp(binding.props.title,textProp(binding.fallback.title,"Distinction"));const body=textProp(binding.props.text,textProp(binding.fallback.text));const standing=textProp(binding.props.standing,"Key distinction");
  return <article className="world-component world-component--text" data-component-ref={binding.component_ref}><div className="world-component__eyebrow">{standing}</div><h3>{title}</h3>{body&&<p>{body}</p>}</article>;
}
function Collection({binding,onOpenRef,subjects=[]}:RendererProps) {
  const title=textProp(binding.props.title,textProp(binding.fallback.title,"Selection"));const items=recordArray(binding.props.items);
  return <section className="world-component world-component--collection" data-component-ref={binding.component_ref}><h3>{title}</h3><div className="world-component__collection">{items.map((item,index)=>{const ref=textProp(item.ref);const label=subjectLabel(item,subjectLabel(subjects.find(subject=>subject.ref===ref),`Unnamed item ${index+1}`));const href=safeHref(item.href);const description=textProp(item.description);const content=<><strong>{label}</strong>{description&&<span>{description}</span>}</>;if(ref&&onOpenRef)return <button type="button" key={`${ref}:${index}`} data-subject-ref={ref} onClick={()=>onOpenRef(ref)}>{content}</button>;if(href)return <a key={`${href}:${index}`} href={href} target="_blank" rel="noreferrer">{content}</a>;return <div key={`${label}:${index}`}>{content}</div>;})}</div></section>;
}
function NamedReferences({binding,onOpenRef,subjects=[]}:RendererProps) {
  const items=recordArray(binding.props.items);
  const rows=referenceLabels(stringArray(binding.props.refs),[...items,...subjects]);
  return rows.length>0?<div className="world-component__refs">{rows.map(({ref,label}: {ref:string;label:string})=><button type="button" key={ref} data-subject-ref={ref} disabled={!onOpenRef} onClick={()=>onOpenRef?.(ref)}>{label}</button>)}</div>:null;
}
function ReferenceCard(props:RendererProps) {
  const {binding}=props;
  const subject=props.subjects?.find(row=>row.ref===binding.subject_ref);
  const title=subjectLabel(binding.props,subjectLabel(subject,subjectLabel(binding.fallback,"Related material")));
  const copy=textProp(binding.props.text,textProp(binding.fallback.text));
  // Earlier native Expression publications used the ref as heading and a
  // role/owner tuple as prose. Recover their existing entity title from the
  // same publication; keep that exact source tuple in deliberate depth.
  const legacy=binding.props.title===binding.subject_ref&&subject?.legacySummary===copy;
  const body=legacy?"":copy;
  return <section className="world-component world-component--collection" data-component-ref={binding.component_ref} data-subject-ref={binding.subject_ref}><h3>{legacy&&binding.subject_ref&&props.onOpenRef?<button type="button" data-subject-ref={binding.subject_ref} onClick={()=>props.onOpenRef?.(binding.subject_ref!)}>{title}</button>:title}</h3>{body&&<p>{body}</p>}{!legacy&&<NamedReferences {...props}/>}<details><summary>Source details</summary><pre>{JSON.stringify({subject_ref:binding.subject_ref,source:binding.props.source,provenance:binding.provenance,...(legacy?{original:binding.props}:{})},null,2)}</pre>{legacy&&<NamedReferences {...props}/>}</details></section>;
}
function WikiReading(props:RendererProps) {
  const {binding}=props;
  const title=textProp(binding.props.title,textProp(binding.fallback.title,"Wiki reading"));const body=textProp(binding.props.text,textProp(binding.fallback.text));
  return <article className="world-component world-component--wiki" data-component-ref={binding.component_ref}><div className="world-component__eyebrow">Knowledge page</div><h3>{title}</h3>{body&&<p>{body}</p>}<NamedReferences {...props}/></article>;
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
  const title=subjectLabel(binding.fallback,"Unavailable section");const text=textProp(binding.fallback.text,"This section cannot be displayed here.");
  return <article className="world-component world-component--fallback" data-component-ref={binding.component_ref} data-renderer-state="fallback"><h3>{title}</h3><p>{text}</p><details><summary>Source details</summary><code>{binding.component_ref}</code></details></article>;
}

type Resolved={state:"live";expression:ExpressionReading;renderer_ref:string}|{state:"fallback";expression:ExpressionReading;fallback:{kind:"image"|"video"|"html";representation:{ref:string;revision:string};href?:string;html?:string}}|{state:"unavailable";expression:ExpressionReading;reason:string};
interface ExpressionReading {expression_ref:string;expression_revision:number;scene_ref?:string;live_renderer_ref:string;subjects:{ref:string}[];representations:unknown[]}

/** A presentation may already expose the EX5 element host; on this main it may not. Detected, never assumed. */
type HostablePresentation=StagePresentation&{setContainer?:(container:HTMLElement|null)=>void};
/** The bounded live-embedding receipt (ES2): the anti-recursion law's answer
 * for this placement — a live slot was taken, or the placement resolves to a
 * visible portal with the owner-stated reason. */
type EmbeddingReceipt={admitted:boolean;reason?:string};
type NativeScene=StageScene&{text:Array<{id:string;visible:boolean;x:number;y:number;width:number;size:number;align:"left"|"center"|"right";kicker:string;title:string;italic:string;body:string}>};

/** The native instrument paints its own authored text. Repaint only on
 * material or viewport change; a heartbeat never allocates another canvas. */
function NativeExpressionText({scene}:{scene:NativeScene}) {
  const canvas=useRef<HTMLCanvasElement>(null);
  useLayoutEffect(()=>{
    const target=canvas.current,host=target?.parentElement;if(!target||!host)return;
    const paint=()=>{
      const {width,height}=host.getBoundingClientRect();if(!width||!height)return;
      const ratio=window.devicePixelRatio||1;
      const pixelWidth=Math.round(width*ratio),pixelHeight=Math.round(height*ratio);
      if(target.width!==pixelWidth)target.width=pixelWidth;
      if(target.height!==pixelHeight)target.height=pixelHeight;
      const context=target.getContext("2d");if(!context)return;
      context.setTransform(ratio,0,0,ratio,0,0);context.clearRect(0,0,width,height);
      paintText(context,scene,width,height);
    };
    const observer=new ResizeObserver(paint);observer.observe(host);paint();
    return()=>observer.disconnect();
  },[scene]);
  return <><canvas ref={canvas} className="world-expression__text" aria-hidden="true"/>
    <div className="world-expression__accessible-text">{scene.text.filter(layer=>layer.visible).map(layer=><article key={layer.id} data-material-text-ref={layer.id}>
      {layer.kicker&&<small>{layer.kicker}</small>}{layer.title&&<strong>{layer.title}</strong>}{layer.italic&&<em>{layer.italic}</em>}{layer.body&&<p>{layer.body}</p>}
    </article>)}</div></>;
}

/** The living body (WORLD-PRESENTATION.md "Expression Field renderer
 * relation"): the same subject/Expression/revision whether the live
 * renderer is admitted or the explicit fallback renders. Renderer pixels
 * are presentation; the refs on the element are the semantic address. */
function ExpressionBody({binding,presentationRef,hosting,onOpenRef,context,onSelectSubject,activity}:RendererProps) {
  const stage=useExpressionStage();const {snapshot:visuals}=useVisuals();
  const rendererAdmitted=hosting==="stage"&&visuals.enabled&&!stage.error;
  const resolved=useMemo<Resolved|{state:"malformed";reason:string}>(()=>{
    try{return resolveExpressionPresentation(binding,{renderer_ref:LIVE_RENDERER_REF,available:rendererAdmitted,focus:false,capture:false}) as Resolved;}
    catch(cause){return {state:"malformed",reason:String(cause instanceof Error?cause.message:cause)};}
  },[binding,rendererAdmitted]);
  // Observation cursors include presence/liveness. They are not material
  // revisions: retain this placement's one configuration while the exact
  // carried material and declared Expression identity stay the same. Compare
  // bytes as well as revision so an inconsistent same-revision payload never
  // silently reuses an older body.
  const materialBytes=JSON.stringify(binding.props.composition);
  const expressionBytes=JSON.stringify(binding.props.expression);
  const composition=useMemo(()=>bindingComposition(binding),[presentationRef,binding.subject_ref,materialBytes,expressionBytes]);
  const authoredScene=composition?.scenes.find(scene=>scene.scene_ref===composition.selection.scene_ref)?.presentation?.scene as (StageScene&{text:Array<{id:string;visible:boolean;x:number;y:number;width:number;size:number;align:"left"|"center"|"right";kicker:string;title:string;italic:string;body:string}>})|undefined;
  const config=useMemo(()=>composition?expressionRenderConfig(composition):null,[composition]);
  const latestMaterial=useRef({composition,config});latestMaterial.current={composition,config};
  const [liveError,setLiveError]=useState<string>();
  const [live,setLive]=useState(false);
  /** ES2 anti-recursion receipt: a portal instead of a second engine. */
  const [portal,setPortal]=useState<EmbeddingReceipt>();
  const inline=useRef<HTMLDivElement>(null);const presentation=useRef<HostablePresentation|null>(null);
  const placement=useRef<HTMLElement>(null);
  const [visible,setVisible]=useState(false);
  const [now,setNow]=useState(()=>Date.now());
  // Age the one retained heartbeat even when a stopped producer causes no
  // subscription update. This clock owns no document, material or GPU buffer.
  useEffect(()=>{
    if(activity?.state!=="bound"||hosting!=="stage"||!visible)return;
    setNow(Date.now());
    const timer=setInterval(()=>setNow(Date.now()),1000);
    return()=>clearInterval(timer);
  },[activity?.state==="bound"?activity.entry.ref:undefined,hosting,visible]);
  const producer=activity?.state==="bound"?activityReading({...activity,liveness_rows:activity.liveness_rows.filter((row):row is object=>typeof row==="object"&&row!==null&&!Array.isArray(row)),now_ms:now}) as {activity_ref:string;liveness:string;owner_state:string|null;owner_revision:number|null}:activity?{activity_ref:activity.activity_ref,liveness:"unavailable",owner_state:null,owner_revision:null}:undefined;
  const producerHeld=Boolean(producer&&(producer.liveness!=="live"||producer.owner_state!=="running"));
  const [leaseEpoch,setLeaseEpoch]=useState(0);
  const waitingForEmbedding=useRef(false);
  const placementId=useId();
  const id=`explore:${presentationRef}:${binding.binding_ref}:${placementId}`;
  useLayoutEffect(()=>{
    const element=placement.current;if(!element)return;
    const measure=()=>{const rect=element.getBoundingClientRect();setVisible(rect.width>0&&rect.height>0);};
    const observer=new ResizeObserver(measure);observer.observe(element);measure();
    return()=>observer.disconnect();
  },[resolved.state]);
  useEffect(()=>onLiveEmbeddingReleased(()=>{if(waitingForEmbedding.current)setLeaseEpoch(epoch=>epoch+1);}),[]);
  useEffect(()=>{
    waitingForEmbedding.current=false;
    if(resolved.state!=="live"||!visible)return;
    const material=latestMaterial.current;
    if(!material.composition||!material.config){setLiveError("The carried composition is not admissible on this client");return;}
    // One law guards every live placement: same-expression same-host — or a
    // depth beyond the budget — resolves to a portal, never another engine.
    const embedding=tryAdmitLive(expression.expression_ref) as {admitted:boolean;resolution:{mode:string;reason?:string};release?:()=>void};
    if(!embedding.admitted){waitingForEmbedding.current=true;setPortal({admitted:false,reason:embedding.resolution.reason});return()=>{waitingForEmbedding.current=false;};}
    setPortal(undefined);
    try{
      const handle=stage.present({id,plane:"overlay",recipe:"",config:material.config,appearance:authoredScene?"authored":"host",sceneRef:material.composition.selection.scene_ref}) as HostablePresentation|null;
      if(!handle)throw new Error(stage.error??"The Expression stage is off, occupied by another presentation in this window, or unavailable");
      presentation.current=handle;
      if(typeof handle.setContainer==="function")handle.setContainer(inline.current);
      setLive(false);setLiveError(undefined);
      void handle.ready().then(()=>{if(presentation.current===handle)setLive(true);}).catch(cause=>{if(presentation.current===handle){setLive(false);setLiveError(String(cause));}});
    }catch(cause){embedding.release?.();presentation.current?.release();presentation.current=null;setLive(false);setLiveError(String(cause instanceof Error?cause.message:cause));}
    return()=>{waitingForEmbedding.current=false;embedding.release?.();presentation.current?.release();presentation.current=null;setLive(false);};
  },[resolved.state,id,stage,visible,leaseEpoch,composition?.expression_ref]);
  useEffect(()=>{
    const handle=presentation.current;
    if(handle&&composition&&config)handle.updateConfig(config,composition.selection.scene_ref,composition.selection.entity_ref?[composition.selection.entity_ref]:[]);
  },[composition,config]);
  useEffect(()=>{presentation.current?.setPaused(producerHeld);},[producerHeld,live,composition?.expression_ref]);
  useLayoutEffect(()=>{const handle=presentation.current;if(handle&&typeof handle.setContainer==="function")handle.setContainer(inline.current);});
  if(resolved.state==="malformed")return <article className="world-component world-component--fallback" role="alert" data-expression-state="malformed"><div className="world-component__eyebrow">Expression unavailable</div><h3>{subjectLabel(binding.fallback,"Expression")}</h3><p>This publication cannot be presented here.</p><details><summary>Source details</summary><p>{resolved.reason}</p></details>{context&&<details><summary>Undertaking details</summary>{context}</details>}</article>;
  const expression=resolved.expression;
  const attributes={"data-expression-ref":expression.expression_ref,"data-expression-revision":expression.expression_revision,"data-subject-ref":binding.subject_ref,"data-live-renderer":expression.live_renderer_ref} as const;
  // ES2 anti-recursion: the same Expression is already live on this host (or
  // the depth budget is spent) — a visible portal names the live occurrence
  // instead of instantiating a second engine.
  if(portal&&!portal.admitted){
    return <section ref={placement} className="world-component world-component--expression world-expression__portal" {...attributes} data-expression-state="portal" data-portal-reason={portal.reason}>
      <div className="world-component__eyebrow">Live elsewhere on this surface</div>
      <h3>{subjectLabel(binding.fallback,"Expression")}</h3>
      <p>This Expression is already open in this window.</p><details><summary>Source details</summary><p>{portal.reason} · {expression.expression_ref} · revision {expression.expression_revision}</p></details>{context&&<details className="world-expression__edition-context"><summary>Undertaking details</summary>{context}</details>}
    </section>;
  }
  if(resolved.state==="live"&&!liveError){
    return <section ref={placement} className="world-component world-component--expression" {...attributes} data-expression-state="live" data-activity-ref={producer?.activity_ref} data-producer-liveness={producer?.liveness} data-owner-state={producer?.owner_state} data-owner-revision={producer?.owner_revision} data-expression-hosting={typeof presentation.current?.setContainer==="function"?"element":"window-stage"}>
      <div ref={inline} className="world-expression__live" aria-label={`Live Expression ${subjectLabel(binding.props,subjectLabel(binding.fallback,"Untitled Expression"))}`} data-rendered={live} onClick={event=>{
        const hit=presentation.current?.hitTest(event.clientX,event.clientY);
        if(hit?.kind==="entity"){
          const entity=composition?.entities[hit.entity_ref];
          if(entity?.subject){(onSelectSubject??onOpenRef)?.(entity.subject.subject_ref);}
        }
      }}>
        {!live&&<p role="status">Presenting on the stage…</p>}
        {authoredScene&&<NativeExpressionText scene={authoredScene as unknown as NativeScene}/>}
        {producer&&<div className="world-expression__producer" role="status" aria-live="polite">
          <strong>{producer.liveness==="live"?(producer.owner_state==="running"?"Shared work is live":producer.owner_state==="completed"?"Work returned":"Work is held"):producer.liveness==="stale"?"The producer has stopped responding":producer.liveness==="disconnected"?"The producer is disconnected":producer.liveness==="unavailable"?"The shared activity is unavailable":"Saved activity"}</strong>
          {producerHeld&&<span>The last reading remains here.</span>}
        </div>}
      </div>
      <nav className="world-expression__navigation" aria-label="Within this Expression">
        <details><summary>People and work</summary><div>{Object.values(composition?.entities??{}).filter(entity=>entity.subject).map(entity=><button type="button" key={entity.entity_ref} data-entity-ref={entity.entity_ref} data-subject-ref={entity.subject!.subject_ref} onClick={()=>{(onSelectSubject??onOpenRef)?.(entity.subject!.subject_ref);}}>{entity.title}</button>)}</div></details>
        {binding.subject_ref&&<button type="button" onClick={()=>{(onSelectSubject??onOpenRef)?.(binding.subject_ref!);}}>Undertaking details</button>}
      </nav>
    </section>;
  }
  const fallback=resolved.state==="fallback"?resolved.fallback:(binding.props.expression as {representations?:Array<{kind:string;representation:{ref:string;revision:string;availability:string};href?:string;html?:string}>}|undefined)?.representations?.find(item=>item.representation.availability==="available"&&((item.kind==="html"&&item.html)||((item.kind==="image"||item.kind==="video")&&item.href)));
  const reason=liveError??(resolved.state==="unavailable"?resolved.reason:hosting==="preview"?"preview shows what a client without the live renderer receives":"live renderer not admitted on this Surface");
  if(fallback){
    const href=safeMedia(fallback.href);
    const originalHtml=fallback.kind==="html"&&typeof fallback.html==="string"?fallback.html:undefined;
    return <figure className="world-component world-component--expression" {...attributes} data-expression-state="fallback" data-fallback-kind={fallback.kind} data-fallback-ref={fallback.representation.ref}>
      {fallback.kind==="image"&&href&&<img src={href} alt={textProp(binding.fallback.title,"Expression capture")}/>}
      {fallback.kind==="video"&&href&&<video src={href} controls preload="metadata"/>}
      {originalHtml&&<iframe className="world-expression__frozen" title={subjectLabel(binding.fallback,"Saved Expression")} sandbox="" srcDoc={originalHtml}/>}
      <figcaption><span>Saved Expression</span><details><summary>Presentation details</summary><p>{fallback.kind} · {fallback.representation.ref} · {fallback.representation.revision} · {reason}</p>{originalHtml&&<details><summary>Original published HTML</summary><pre>{originalHtml}</pre></details>}</details></figcaption>{context&&<details className="world-expression__edition-context"><summary>Undertaking details</summary>{context}</details>}
    </figure>;
  }
  return <article className="world-component world-component--fallback" {...attributes} data-expression-state="unavailable"><div className="world-component__eyebrow">Expression unavailable</div><h3>{subjectLabel(binding.fallback,"Untitled Expression")}</h3><p>No saved presentation is available here.</p><details><summary>Presentation details</summary><p>{reason}</p></details>{context&&<details className="world-expression__edition-context"><summary>Undertaking details</summary>{context}</details>}</article>;
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

export function WorldPresentationView({presentation,onOpenRef,hosting="stage",subjects=[],context,onSelectSubject,activity}:{presentation:WorldPresentation;onOpenRef?:(ref:string)=>void;hosting?:ExpressionHosting;subjects?:{ref:string;label?:string;title?:string}[];context?:ReactNode;onSelectSubject?:RendererProps["onSelectSubject"];activity?:ProducerBinding}) {
  const expressionBindings=presentation.regions.flatMap(region=>region.bindings).filter(binding=>(binding.portable_renderer??binding.component_ref)==="oi.presentation/expression/v1");
  const expressionBody=expressionBindings.length===1;
  const entitySubjects=presentation.regions.flatMap(region=>region.bindings).flatMap(binding=>Object.values(bindingComposition(binding)?.entities??{})).filter(entity=>entity.subject).map(entity=>({ref:entity.subject!.subject_ref,title:entity.title,legacySummary:`${entity.subject!.presentation_role??'thing'} · ${entity.subject!.native_owner??'native owner'}`}));
  const namedSubjects=[...subjects.map(subject=>({...subject,legacySummary:entitySubjects.find(entity=>entity.ref===subject.ref)?.legacySummary})),...entitySubjects];
  const regions=<>{presentation.regions.map(region=><section key={region.region_ref} className="world-region" data-region-ref={region.region_ref} data-region-role={region.role}>
      {region.label&&<div className="world-region__label">{region.label}</div>}
      <div className="world-region__components">{region.bindings.filter(binding=>!expressionBody||binding!==expressionBindings[0]).map(binding=>{const key=binding.portable_renderer??binding.component_ref;const Renderer=portablePresentationRenderers[key]??Fallback;return <div key={binding.binding_ref} className="world-binding" data-binding-ref={binding.binding_ref} data-component-ref={binding.component_ref} data-renderer-key={key} data-renderer-available={Boolean(portablePresentationRenderers[key])}><Renderer binding={binding} presentationRef={presentation.presentation_ref} onOpenRef={onOpenRef} hosting={hosting} subjects={namedSubjects}/></div>;})}</div>
    </section>)}</>;
  return <article className={`world-presentation${expressionBody?" world-presentation--expression":""}`} data-presentation-ref={presentation.presentation_ref} data-presentation-revision={presentation.revision} data-world-ref={presentation.world_ref} style={presentationThemeStyle(presentation)}>
    {expressionBody?<ExpressionBody binding={expressionBindings[0]} presentationRef={presentation.presentation_ref} onOpenRef={onOpenRef} hosting={hosting} subjects={namedSubjects} onSelectSubject={onSelectSubject} activity={activity} context={<>{regions}{context}</>}/>:<><header className="world-presentation__masthead"><div><div className="world-component__eyebrow">Shared page</div><h1>{subjectLabel(presentation,"Untitled page")}</h1></div>{presentation.summary&&<p>{presentation.summary}</p>}</header>{regions}{context}</>}
  </article>;
}
