import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon, SourceText } from './ui';
import { openPublication, publicationRoute, publicationHref, publicAssetUrl, type PublicationRoute, type PublicModel, type PublicSubject, type PublicForm, type PublicStage } from './publication-model.mjs';
import './publication.css';
import { PublicationStanding } from './PublicationStanding';
const NativeStage=lazy(()=>import('./NativeStage').then(m=>({default:m.NativeStage})));
const install='https://github.com/EpiLogos/O-I/blob/0b3583be80868bcc3edfb4a449ae17010f0bbd74/docs/INSTALL.md';
const operating='https://github.com/EpiLogos/O-I/blob/0b3583be80868bcc3edfb4a449ae17010f0bbd74/docs/INSTALL-UPDATE-FLOW.md';
const manifestLink=(value?:string)=>typeof value==='string'&&/^\.\/data\/library\/editions\/[a-f0-9]{64}\/(?:index\.html|projection\.json)$/.test(value)?value:null;
function usePublication() {
 const [model,setModel]=useState<PublicModel|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{const controller=new AbortController();setModel(null);setError('');
  const get=async(path:string)=>{const r=await fetch(path,{signal:controller.signal,cache:'no-store',credentials:'omit'});if(!r.ok)throw new Error('unavailable');return r.json();};
  Promise.all([get('./data/library/published.json'),get('./data/library/edition-manifests.json')]).then(([seed,manifests])=>{if(!controller.signal.aborted)setModel(openPublication(seed,manifests));}).catch(()=>{if(!controller.signal.aborted)setError(navigator.onLine?'The published Library could not be opened. Its exact edition has not been replaced with sample content.':'You are offline. This reading has not been downloaded; reconnect to open the published edition.');});
  return()=>controller.abort();
 },[retry]);
 return {model,error,retry:()=>setRetry(n=>n+1)};
}
function SetupAccess(){return <details className="publication-setup"><summary>Install & setup</summary><p>Public reading needs no installation or Agent key. To work locally, choose the native products you need and follow the accepted installation route.</p><p>The documented prebuilt release targets are Apple Silicon macOS and x64 Linux. A historical release is not the current development suite; establishing a current personal ground requires Rust and current Central. The short npm registry command is not assumed available.</p><p>For an existing source installation, <code>oi update --check</code> reports standing. Applying an update is an explicit native operation; it is never performed by this website. Read the selected-cut, mainline and rollback conditions before updating.</p><a href={install} target="_blank" rel="noreferrer">Accepted installation instructions <Icon name="external"/></a><a href={operating} target="_blank" rel="noreferrer">Operating, update and recovery instructions <Icon name="external"/></a><small>Instruction basis: O:I 0b3583be. These links preserve the inspected edition, not an assertion about every later release.</small></details>;}
function subjectAddress(route:Partial<PublicationRoute>,ref:string) {
 return publicationHref({...route,ref,projection:'',revision:'',expression:'',expression_revision:'',expression_projection:'',expression_projection_revision:'',scene:'',depth:'read',at:'0',offset:'0',focus_ref:route.focus_ref||ref});
}
function listingAddress(route:Partial<PublicationRoute>) {
 return publicationHref({collection_ref:route.collection_ref,q:route.q,page:route.page,focus_ref:route.focus_ref||route.ref});
}
function Listing({model,query='',collection='',page=1,focusRef=''}:{model:PublicModel;query?:string;collection?:string;page?:number;focusRef?:string}) {
 let result;try{result=model.searchPage(query,collection,page);}catch(error){return <section role="alert"><p>{String(error)}</p><a href={publicationHref({collection_ref:collection,q:query,page:'1'})}>Open the first results page</a></section>;}
 const {items,total,pages}=result,collections=model.collections();
 const route={q:query,collection_ref:collection,page:String(page),focus_ref:focusRef};
 return <><nav className="publication-collections" aria-label="Published corpus collections"><a href={publicationHref({q:query})} aria-current={!collection?'page':undefined}>All published subjects</a>{collections.map(c=><a key={c.ref} href={publicationHref({collection_ref:c.ref,q:query})} aria-current={collection===c.ref?'page':undefined}>{c.label}</a>)}</nav>
 {!items.length?<div className="publication-empty"><h3>{model.records.length?'No published subjects match this view.':'The corpus has not been published to this edition yet.'}</h3><p>{model.records.length?'Choose another collection or clear the search. Membership follows the actual published subjects.':'The Library receiver is available. It will show the producer’s admitted public subjects, collections and revisions when supplied—not demo entries or a copy of the private working world.'}</p></div>:<><p className="publication-count" role="status">{total} published subjects · page {page} of {pages}</p><div className="publication-cards">{items.map(item=><article key={item.ref}><span>{item.kind}</span><h3><a data-result-ref={item.ref} href={subjectAddress({...route,focus_ref:item.ref},item.ref)}>{item.label}</a></h3>{item.summary&&<p>{item.summary}</p>}<small>Read the published subject <Icon name="arrowRight"/></small></article>)}</div>{pages>1&&<nav className="publication-pagination" aria-label="Published result pages">{page>1&&<a href={publicationHref({...route,page:String(page-1),focus_ref:''})}>Previous results</a>}<span>Page {page} of {pages}</span>{page<pages&&<a href={publicationHref({...route,page:String(page+1),focus_ref:''})}>Next results</a>}</nav>}</>}
 </>;
}
/** The primary native-subject section lives inside the existing Gallery. */
export function PublishedShelf({query=''}:{query?:string}) {
 const {model,error,retry}=usePublication();
 const primaryCollection=model?.collections()[0]?.ref||'';
 return <section className="published-shelf" aria-label="Native published subjects"><header><div><p className="eyebrow">PUBLICATIONS / NATIVE SUBJECTS</p><h2>Read the work.</h2></div><SetupAccess/></header><p>Deliberately published editions. Source, Expression and graph remain different views of the same subjects. This is not a live subscription.</p>
 {error?<div role="alert"><p>{error}</p><button onClick={retry}>Retry public Library</button></div>:model?<Listing model={model} query={query} collection={primaryCollection}/>:<p role="status">Opening the published collection…</p>}
 {model&&<PublicationStanding model={model}/>}
 </section>;
}
function EditionLinks({subject}:{subject:PublicSubject}) {
 const p=subject.projection,m=subject.manifest;
 return <dl className="publication-basis"><dt>Subject</dt><dd>{subject.resource.ref}</dd><dt>Publication</dt><dd>{p.projection_ref} · revision {p.projection_revision}</dd><dt>Native source</dt><dd>{p.source.system} · {p.source.ref} · {p.source.revision}</dd><dt>Published</dt><dd>{p.published_at}</dd><dt>Delivery</dt><dd>Deliberately published edition, not a live subscription. Reading does not contact an author’s machine.</dd>{m&&<><dt>Edition bytes</dt><dd>SHA-256 {m.digest.value}</dd><dt>Source depth</dt><dd>{manifestLink(m.page)&&<a href={m.page} target="_blank" rel="noreferrer">Standalone native reading</a>}{manifestLink(m.projection_file)&&<a href={m.projection_file} target="_blank" rel="noreferrer">Exact public Projection JSON</a>}</dd></>}</dl>;
}
function ExpressionBody({model,form,route,navigate,active}:{active:boolean;model:PublicModel;form:PublicForm;route:PublicationRoute;navigate:(patch:Partial<PublicationRoute>)=>void}) {
 const [playing,setPlaying]=useState(()=>!matchMedia('(prefers-reduced-motion: reduce)').matches);
 const [notice,setNotice]=useState('');
 useEffect(()=>{const q=matchMedia('(prefers-reduced-motion: reduce)');const change=()=>{if(q.matches)setPlaying(false);};q.addEventListener('change',change);return()=>q.removeEventListener('change',change);},[]);
 let stage:PublicStage;try{stage=model.stage(form,route.scene);}catch(error){return <p role="alert">{String(error)}</p>;}
 const fallback=stage.admission.fallback;
 if (!stage.edition || !stage.scene) return <section className="publication-empty"><h2>The native field is unavailable here.</h2><p>{stage.admission.reason || 'This edition does not admit the installed browser renderer. Its subject reading remains available.'}</p>{fallback?.href&&publicAssetUrl(fallback.href)&&(fallback.kind==='image'?<img src={fallback.href} alt="Publisher-supplied frozen Expression representation"/>:fallback.kind==='video'?<video src={fallback.href} controls playsInline preload="metadata"/>:null)}<p>Frozen media is a representation of this edition, not an interactive replacement. Undeclared HTML and runtime code are never executed.</p></section>;
 const {edition,scene}=stage;
 return <div className="published-expression"><nav className="publication-scenes" aria-label="Published Expression Scenes">{edition.entry.scenes.map(s=><a key={s.ref} href={publicationHref({...route,scene:s.ref})} aria-current={s.ref===scene.scene_ref?'step':undefined}>{s.title}</a>)}</nav><p>Expression {edition.entry.expression_ref} · revision {edition.entry.revision}. The field is interactive; its publication is a fixed edition.</p><button onClick={()=>setPlaying(v=>!v)} aria-pressed={playing}>{playing?'Pause field motion':'Play field motion'}</button><div className="publication-stage"><Suspense fallback={<p role="status">Loading the native field…</p>}><NativeStage edition={edition} scene={scene} active={active} playing={playing} selected={scene.entity_refs.find(ref=>edition.publication.composition.entities[ref].subject?.subject_ref===route.ref)||''} onTick={()=>{}} onCamera={()=>{}} onScene={scene=>navigate({scene})} onSelect={ref=>{const subject=edition.publication.composition.entities[ref].subject?.subject_ref;if(subject===route.ref)navigate({depth:'read'});else if(subject&&model.model.open(subject))location.hash=subjectAddress(publicationRoute(location.hash),subject);else setNotice('This formation has no disclosed subject reading in this edition. No local source will be fetched.');}}/></Suspense></div>{notice&&<p role="status">{notice}</p>}</div>;
}
export default function PublicLibrary() {
 const {model,error,retry}=usePublication();
 const [route,setRoute]=useState(()=>publicationRoute(location.hash));
 const main=useRef<HTMLElement>(null),restoring=useRef(false);
 const [resident,setResident]=useState('');
 const navigate=(patch:Partial<PublicationRoute>)=>{location.hash=publicationHref({...publicationRoute(location.hash),...patch});};
 useEffect(()=>{const changed=()=>setRoute(publicationRoute(location.hash));window.addEventListener('hashchange',changed);window.addEventListener('popstate',changed);return()=>{window.removeEventListener('hashchange',changed);window.removeEventListener('popstate',changed);};},[]);
 let subject:PublicSubject|undefined,problem=error;
 if(model&&route.ref){try{subject=model.select(route.ref,route.projection,route.revision);}catch(e){problem=String(e);}}
 const record=subject, p=record?.projection;
 const identity=p?`${record!.resource.ref}@${p.projection_ref}@${p.projection_revision}`:'';
 // Exact native revision goes into history before the reader leaves this view.
 useEffect(()=>{if(record&&(!route.projection||!route.revision)){const next={...route,ref:record.resource.ref,projection:record.projection.projection_ref,revision:String(record.projection.projection_revision)};history.replaceState(null,'',publicationHref(next));setRoute(next);}document.title=record?`${record.resource.label} — O:I Library`:'Published collection — O:I Library';},[identity,route.projection,route.revision]);
 useLayoutEffect(()=>{if(!model)return;restoring.current=true;const frame=requestAnimationFrame(()=>{main.current?.focus({preventScroll:true});const block=main.current?.querySelector<HTMLElement>(`[data-reading-at="${route.at}"]`);if(route.depth==='read'&&block){const y=block.getBoundingClientRect().top+window.scrollY;window.scrollTo(0,y+Number(route.offset)*block.offsetHeight-100);}else {const result=!record&&route.focus_ref?main.current?.querySelector<HTMLElement>(`[data-result-ref="${CSS.escape(route.focus_ref)}"]`):null;if(result){result.focus({preventScroll:true});result.scrollIntoView({block:'center',behavior:'instant'});}else window.scrollTo(0,0);}restoring.current=false;});return()=>cancelAnimationFrame(frame);},[identity,route.depth,model,route.at,route.page,route.collection_ref]);
 useEffect(()=>{
  if(!record||route.depth!=='read')return;
  let frame=0;
  const save=()=>{if(restoring.current||frame)return;frame=requestAnimationFrame(()=>{
   frame=0;if(restoring.current)return;
   const current=publicationRoute(location.hash);
   // A scroll scheduled by the old page must never stamp its paragraph onto a
   // newly selected subject/depth while history is changing.
   if(current.ref!==record.resource.ref||current.depth!=='read'||current.projection!==record.projection.projection_ref||current.revision!==String(record.projection.projection_revision))return;
   const blocks=[...main.current?.querySelectorAll<HTMLElement>('[data-reading-at]')||[]];
   const block=blocks.filter(b=>b.getBoundingClientRect().top<=120).at(-1)||blocks[0];if(!block)return;
   history.replaceState(null,'',publicationHref({...current,at:block.dataset.readingAt||'0',offset:String(Math.max(0,Math.min(1,(100-block.getBoundingClientRect().top)/Math.max(1,block.offsetHeight))))}));
  });};
  window.addEventListener('scroll',save,{passive:true});
  return()=>{window.removeEventListener('scroll',save);cancelAnimationFrame(frame);};
 },[identity,route.depth]);
 const forms=model&&record?model.expressions(record.resource.ref):[];
 const selectedForms=forms.filter(f=>(!route.expression||f.binding.props.expression.expression_ref===route.expression)&&(!route.expression_revision||String(f.binding.props.expression.expression_revision)===route.expression_revision)&&(!route.expression_projection||f.projection.projection_ref===route.expression_projection)&&(!route.expression_projection_revision||String(f.projection.projection_revision)===route.expression_projection_revision));
 const form=selectedForms.length===1?selectedForms[0]:undefined;
 const formKey=form?`${identity}@${form.projection.projection_ref}@${form.projection.projection_revision}`:'';
 useEffect(()=>{if(route.depth==='expression'&&formKey)setResident(formKey);},[route.depth,formKey]);
 useEffect(()=>{if(route.depth!=='expression'||!form||!record)return;const next={...publicationRoute(location.hash),expression:form.binding.props.expression.expression_ref,expression_revision:String(form.binding.props.expression.expression_revision),expression_projection:form.projection.projection_ref,expression_projection_revision:String(form.projection.projection_revision),scene:route.scene||form.binding.props.expression.scene_ref||form.binding.props.composition.selection.scene_ref};if(publicationHref(next)!==location.hash){history.replaceState(null,'',publicationHref(next));setRoute(next);}},[identity,route.depth,form?.projection.projection_ref,form?.projection.projection_revision,route.scene]);
 const blocks=record?.readings.flatMap(b=>{const text=b.props.text||b.fallback.text||'';return [{title:b.props.title||b.fallback.title||record!.resource.label,text,refs:Array.isArray(b.props.refs)?b.props.refs:[],metadata:b.portable_renderer==='oi.presentation/reference-card/v1'}];})||[];
 let paragraph=0;
 return <main className="oi-library native-public-library" id="main-content" tabIndex={-1} ref={main}>
 <header className="library-header"><a href="#/" className="library-monogram" aria-label="O:I home">{'{O:I}'}</a><nav aria-label="Reading navigation"><a href="#/library">Library</a>{record?<a href={listingAddress(route)}>Return to results</a>:route.collection_ref&&<a href={listingAddress(route)}>Collection</a>}</nav><SetupAccess/></header>
 <div className="library-body publication-body">
 {problem?<section className="publication-empty" role="alert"><h1>This exact reading is unavailable.</h1><p>{problem}</p><button onClick={retry}>Try again</button><a href={publicationHref()}>Choose from the published Library</a><p>The source may be unpublished, withdrawn, changed or unreachable. No installation or Agent credential is required to read an eligible edition.</p></section>:!model?<p role="status">Opening the published edition…</p>:!record?<><p className="eyebrow">O:I LIBRARY / PUBLISHED SUBJECTS</p><h1>{route.collection_ref?model.model.open(route.collection_ref)?.resource.label||'Collection unavailable':'The published work.'}</h1><label className="library-search"><Icon name="search"/><input aria-label="Search published subjects" type="search" value={route.q} onChange={e=>{const next={...route,q:e.target.value,page:'1',focus_ref:''};history.replaceState(null,'',publicationHref(next));setRoute(next);}}/></label><Listing model={model} query={route.q} collection={route.collection_ref} page={Number(route.page)} focusRef={route.focus_ref}/></>:<>
 <p className="eyebrow">{record.resource.kind} / PUBLISHED EDITION</p><h1>{record.resource.label}</h1>
 <nav className="publication-depth" aria-label="Subject depth">{(['read','expression','relations','source'] as const).map(depth=><a key={depth} href={publicationHref({...publicationRoute(location.hash),depth})} onClick={e=>{e.preventDefault();navigate({depth});}} aria-current={route.depth===depth?'page':undefined}>{depth==='read'?'Read':depth==='expression'?'Expression':depth==='relations'?'Graph relations':'Source & edition'}</a>)}</nav>
 {route.depth!=='read'&&<a className="publication-return" href={publicationHref({...publicationRoute(location.hash),depth:'read'})} onClick={e=>{e.preventDefault();navigate({depth:'read'});}}>Return to {record.resource.label} at the same reading position <Icon name="arrowLeft"/></a>}
 {route.depth==='read'&&<div className="publication-reading" onClick={e=>{const link=(e.target as Element).closest('a');if(!link)return;const url=new URL(link.href);const ref=url.searchParams.get('ref');if(ref&&url.origin===location.origin&&url.pathname.endsWith('/explore.html')){e.preventDefault();location.hash=subjectAddress(publicationRoute(location.hash),ref);}}}>
 {!blocks.length&&<p>This publication has no disclosed text for this subject. Its available presentations and source identity remain accessible below; no other text has been substituted.</p>}
 {blocks.map((block,i)=><section key={i}><h2>{block.title}</h2>{block.metadata&&<p className="publication-notice">Reference metadata is published here, not the complete source document.</p>}{block.text.split(/\n\s*\n/).filter(Boolean).map((text:string)=><div key={paragraph} data-reading-at={paragraph++}><SourceText body={text}/></div>)}{block.refs.map((ref:string)=>model.model.open(ref)?<a className="publication-ref" key={ref} href={subjectAddress(publicationRoute(location.hash),ref)}>{model.model.open(ref).resource.label}</a>:<span className="publication-ref" key={ref}>Disclosed reference: {ref} — not included as a reading in this edition.</span>)}</section>)}
 <section className="publication-next"><h2>In this edition</h2><PublicationStanding model={model} subject={record}/><p>Read the disclosed text, follow declared relations and inspect the exact publication basis. {forms.length?'An Expression is published for this subject.':'No native Expression is published for this subject in this edition.'}</p><p>Graph depth uses the published relations only. A browser-safe Technè instrument, further native scene bodies and complete source coverage must arrive through their owning publication outputs; this reader does not recreate them.</p><p>Ongoing integration enables the same subject to move through richer Expressions, source portals and permitted instruments without becoming another copy of the work.</p></section>
 </div>}
 {form&&(route.depth==='expression'||resident===formKey)&&<section hidden={route.depth!=='expression'} className="publication-resident"><ExpressionBody key={formKey} model={model} form={form} route={route} navigate={navigate} active={route.depth==='expression'}/></section>}
 {route.depth==='expression'&&!form&&<section className="publication-empty"><h2>{forms.length?'Choose an exact Expression edition.':'No native Expression is published for this subject yet.'}</h2><p>Sandbox journeys and generated sample scenes are not substituted for native publication.</p>{forms.map(f=><a key={f.projection.projection_ref} href={publicationHref({...route,expression:f.binding.props.expression.expression_ref,expression_revision:String(f.binding.props.expression.expression_revision),expression_projection:f.projection.projection_ref,expression_projection_revision:String(f.projection.projection_revision),scene:''})}>{f.presentation.title} · Expression revision {f.binding.props.expression.expression_revision} · Projection {f.projection.projection_revision}</a>)}</section>}
 {route.depth==='relations'&&<section className="publication-relations"><h2>Declared graph neighbourhood</h2>{record.relations.length?record.relations.map((r,i)=>{const ref=r.from===record!.resource.ref?r.to:r.from;return <a key={r.relation_ref||i} href={subjectAddress(publicationRoute(location.hash),ref)}><span>{r.from===record!.resource.ref?'Outgoing':'Incoming'} · {r.relation}</span>{model.model.open(ref)?.resource.label||ref}</a>;}):<p>No eligible relations were published for this subject. Visual proximity is not a semantic edge.</p>}<p>This is the existing Explore relation model, not a separately authored graph. No local or private neighbourhood is requested.</p></section>}
 {route.depth==='source'&&<section><h2>Source, edition and permissions</h2><EditionLinks subject={record}/><p>The public Projection is read-only. Inspecting it grants no authority to edit its native source or to invoke the publisher’s Actions. No agent credentials, raw runtime evidence or private machine data are included here.</p></section>}
 </>}
 </div></main>;
}
